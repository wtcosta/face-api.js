const faceapi = require('face-api.js');
const crypto = require('crypto');
const { canvas, faceDetectionNet, faceDetectionOptions, saveFile } = require('./commons');

// Simulação de banco de dados (em produção, use MongoDB, PostgreSQL, etc.)
class FaceDatabase {
  constructor() {
    this.faces = new Map(); // Simula uma tabela de faces
  }

  /**
   * Salva um hash facial no banco de dados
   */
  saveFaceHash(userId, hash, metadata = {}) {
    const faceRecord = {
      userId,
      hash,
      metadata,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    this.faces.set(userId, faceRecord);
    console.log(`Hash salvo para usuário: ${userId}`);
    return faceRecord;
  }

  /**
   * Busca um hash facial por userId
   */
  getFaceHash(userId) {
    return this.faces.get(userId);
  }

  /**
   * Valida se um hash corresponde a um usuário
   */
  validateFaceHash(userId, inputHash, threshold = 0.8) {
    const storedRecord = this.faces.get(userId);
    if (!storedRecord) {
      return { valid: false, reason: 'Usuário não encontrado' };
    }

    const similarity = this.compareHashes(storedRecord.hash, inputHash);
    const isValid = similarity >= threshold;

    if (isValid) {
      // Atualiza último uso
      storedRecord.lastUsed = new Date().toISOString();
    }

    return {
      valid: isValid,
      similarity,
      threshold,
      reason: isValid ? 'Hash válido' : 'Hash não corresponde'
    };
  }

  /**
   * Compara dois hashes e retorna similaridade
   */
  compareHashes(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      return 0;
    }

    let matches = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) {
        matches++;
      }
    }

    return matches / hash1.length;
  }

  /**
   * Lista todos os usuários cadastrados
   */
  listUsers() {
    return Array.from(this.faces.keys());
  }

  /**
   * Remove um usuário do banco
   */
  removeUser(userId) {
    return this.faces.delete(userId);
  }
}

class FaceHashGenerator {
  
  /**
   * Gera um hash SHA-256 baseado no descriptor facial
   */
  static generateSHA256Hash(descriptor) {
    const descriptorString = Array.from(descriptor).join(',');
    return crypto.createHash('sha256').update(descriptorString).digest('hex');
  }

  /**
   * Gera um hash facial padronizado para validação
   */
  static generateValidationHash(descriptor) {
    return this.generateSHA256Hash(descriptor);
  }
}

class FaceValidationSystem {
  constructor() {
    this.database = new FaceDatabase();
  }

  /**
   * Cadastra um novo usuário com hash facial
   */
  async registerUser(userId, imagePath, metadata = {}) {
    console.log(`\n=== CADASTRANDO USUÁRIO: ${userId} ===`);
    
    try {
      // Carrega e processa a imagem
      const image = await canvas.loadImage(imagePath);
      
      // Detecta face e gera descriptor
      const result = await faceapi.detectSingleFace(image, faceDetectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        throw new Error('Nenhuma face detectada na imagem');
      }

      // Gera hash de validação
      const hash = FaceHashGenerator.generateValidationHash(result.descriptor);
      
      // Salva no banco de dados
      const faceRecord = this.database.saveFaceHash(userId, hash, {
        ...metadata,
        descriptorLength: result.descriptor.length,
        confidence: result.detection.score
      });

      console.log('✅ Usuário cadastrado com sucesso!');
      console.log(`Hash: ${hash.substring(0, 32)}...`);
      
      return faceRecord;
      
    } catch (error) {
      console.error('❌ Erro ao cadastrar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Valida um usuário usando hash facial
   */
  async validateUser(userId, imagePath) {
    console.log(`\n=== VALIDANDO USUÁRIO: ${userId} ===`);
    
    try {
      // Carrega e processa a imagem
      const image = await canvas.loadImage(imagePath);
      
      // Detecta face e gera descriptor
      const result = await faceapi.detectSingleFace(image, faceDetectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        throw new Error('Nenhuma face detectada na imagem');
      }

      // Gera hash de validação
      const inputHash = FaceHashGenerator.generateValidationHash(result.descriptor);
      
      // Valida contra o banco de dados
      const validation = this.database.validateFaceHash(userId, inputHash);
      
      console.log(`Hash de entrada: ${inputHash.substring(0, 32)}...`);
      console.log(`Similaridade: ${(validation.similarity * 100).toFixed(2)}%`);
      console.log(`Threshold: ${(validation.threshold * 100).toFixed(2)}%`);
      
      if (validation.valid) {
        console.log('✅ Usuário validado com sucesso!');
      } else {
        console.log('❌ Validação falhou:', validation.reason);
      }
      
      return validation;
      
    } catch (error) {
      console.error('❌ Erro ao validar usuário:', error.message);
      throw error;
    }
  }

  /**
   * Lista todos os usuários cadastrados
   */
  listRegisteredUsers() {
    const users = this.database.listUsers();
    console.log('\n=== USUÁRIOS CADASTRADOS ===');
    
    if (users.length === 0) {
      console.log('Nenhum usuário cadastrado.');
      return [];
    }
    
    users.forEach(userId => {
      const record = this.database.getFaceHash(userId);
      console.log(`- ${userId} (cadastrado em: ${record.createdAt})`);
    });
    
    return users;
  }

  /**
   * Remove um usuário do sistema
   */
  removeUser(userId) {
    const removed = this.database.removeUser(userId);
    if (removed) {
      console.log(`✅ Usuário ${userId} removido com sucesso!`);
    } else {
      console.log(`❌ Usuário ${userId} não encontrado.`);
    }
    return removed;
  }
}

// Exemplo de uso do sistema
async function demonstrateSystem() {
  console.log('🚀 Iniciando Sistema de Validação Facial\n');
  
  // Carrega modelos
  console.log('Carregando modelos...');
  await faceDetectionNet.loadFromDisk('../../weights');
  await faceapi.nets.faceLandmark68Net.loadFromDisk('../../weights');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('../../weights');
  console.log('✅ Modelos carregados!\n');

  // Cria instância do sistema
  const validationSystem = new FaceValidationSystem();

  try {
    // 1. Cadastra usuários
    await validationSystem.registerUser('joao', '../images/bbt1.jpg', {
      name: 'João Silva',
      email: 'joao@email.com'
    });

    await validationSystem.registerUser('maria', '../images/bbt2.jpg', {
      name: 'Maria Santos',
      email: 'maria@email.com'
    });

    // 2. Lista usuários cadastrados
    validationSystem.listRegisteredUsers();

    // 3. Valida usuários (teste com mesma imagem)
    await validationSystem.validateUser('joao', '../images/bbt1.jpg');
    await validationSystem.validateUser('maria', '../images/bbt2.jpg');

    // 4. Teste de validação com usuário inexistente
    console.log('\n=== TESTE: VALIDAR USUÁRIO INEXISTENTE ===');
    await validationSystem.validateUser('pedro', '../images/bbt1.jpg');

    // 5. Remove um usuário
    validationSystem.removeUser('maria');
    validationSystem.listRegisteredUsers();

  } catch (error) {
    console.error('Erro no sistema:', error.message);
  }
}

// Executa o exemplo
demonstrateSystem();
