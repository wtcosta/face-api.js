const faceapi = require('face-api.js');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { canvas, faceDetectionNet, faceDetectionOptions } = require('./commons');

// Configuração do MongoDB
const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'face_validation_system';
const COLLECTION_NAME = 'users';

class MongoDBFaceDatabase {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
  }

  /**
   * Conecta ao MongoDB
   */
  async connect() {
    try {
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
      
      this.db = this.client.db(DATABASE_NAME);
      this.collection = this.db.collection(COLLECTION_NAME);
      
      // Cria índice único no userId
      await this.collection.createIndex({ userId: 1 }, { unique: true });
      
      console.log('✅ Conectado ao MongoDB');
    } catch (error) {
      console.error('❌ Erro ao conectar ao MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Desconecta do MongoDB
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✅ Desconectado do MongoDB');
    }
  }

  /**
   * Salva um hash facial no banco de dados
   */
  async saveFaceHash(userId, hash, metadata = {}) {
    try {
      const faceRecord = {
        userId,
        hash,
        metadata,
        createdAt: new Date(),
        lastUsed: new Date(),
        updatedAt: new Date()
      };

      // Usa upsert para atualizar se existir ou inserir se não existir
      const result = await this.collection.updateOne(
        { userId },
        { $set: faceRecord },
        { upsert: true }
      );

      console.log(`Hash salvo para usuário: ${userId}`);
      return faceRecord;
    } catch (error) {
      console.error('Erro ao salvar hash:', error.message);
      throw error;
    }
  }

  /**
   * Busca um hash facial por userId
   */
  async getFaceHash(userId) {
    try {
      return await this.collection.findOne({ userId });
    } catch (error) {
      console.error('Erro ao buscar hash:', error.message);
      throw error;
    }
  }

  /**
   * Valida se um hash corresponde a um usuário
   */
  async validateFaceHash(userId, inputHash, threshold = 0.8) {
    try {
      const storedRecord = await this.getFaceHash(userId);
      
      if (!storedRecord) {
        return { valid: false, reason: 'Usuário não encontrado' };
      }

      const similarity = this.compareHashes(storedRecord.hash, inputHash);
      const isValid = similarity >= threshold;

      if (isValid) {
        // Atualiza último uso
        await this.collection.updateOne(
          { userId },
          { 
            $set: { 
              lastUsed: new Date(),
              updatedAt: new Date()
            }
          }
        );
      }

      return {
        valid: isValid,
        similarity,
        threshold,
        reason: isValid ? 'Hash válido' : 'Hash não corresponde'
      };
    } catch (error) {
      console.error('Erro ao validar hash:', error.message);
      throw error;
    }
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
  async listUsers() {
    try {
      const users = await this.collection.find({}, { projection: { userId: 1, createdAt: 1, metadata: 1 } }).toArray();
      return users;
    } catch (error) {
      console.error('Erro ao listar usuários:', error.message);
      throw error;
    }
  }

  /**
   * Remove um usuário do banco
   */
  async removeUser(userId) {
    try {
      const result = await this.collection.deleteOne({ userId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Erro ao remover usuário:', error.message);
      throw error;
    }
  }

  /**
   * Busca usuários por similaridade de hash (para reconhecimento)
   */
  async findUserByHash(inputHash, threshold = 0.8) {
    try {
      const users = await this.collection.find({}).toArray();
      
      for (const user of users) {
        const similarity = this.compareHashes(user.hash, inputHash);
        if (similarity >= threshold) {
          return {
            userId: user.userId,
            similarity,
            metadata: user.metadata
          };
        }
      }
      
      return null; // Nenhum usuário encontrado
    } catch (error) {
      console.error('Erro ao buscar usuário por hash:', error.message);
      throw error;
    }
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
    this.database = new MongoDBFaceDatabase();
  }

  /**
   * Inicializa o sistema
   */
  async initialize() {
    await this.database.connect();
  }

  /**
   * Finaliza o sistema
   */
  async shutdown() {
    await this.database.disconnect();
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
      const faceRecord = await this.database.saveFaceHash(userId, hash, {
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
      const validation = await this.database.validateFaceHash(userId, inputHash);
      
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
   * Reconhece um usuário sem saber o ID (reconhecimento facial)
   */
  async recognizeUser(imagePath) {
    console.log('\n=== RECONHECIMENTO FACIAL ===');
    
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
      
      // Busca usuário por similaridade
      const recognizedUser = await this.database.findUserByHash(inputHash);
      
      if (recognizedUser) {
        console.log('✅ Usuário reconhecido!');
        console.log(`ID: ${recognizedUser.userId}`);
        console.log(`Similaridade: ${(recognizedUser.similarity * 100).toFixed(2)}%`);
        console.log(`Dados:`, recognizedUser.metadata);
      } else {
        console.log('❌ Usuário não reconhecido');
      }
      
      return recognizedUser;
      
    } catch (error) {
      console.error('❌ Erro no reconhecimento:', error.message);
      throw error;
    }
  }

  /**
   * Lista todos os usuários cadastrados
   */
  async listRegisteredUsers() {
    const users = await this.database.listUsers();
    console.log('\n=== USUÁRIOS CADASTRADOS ===');
    
    if (users.length === 0) {
      console.log('Nenhum usuário cadastrado.');
      return [];
    }
    
    for (const user of users) {
      console.log(`- ${user.userId} (cadastrado em: ${user.createdAt})`);
      if (user.metadata.name) {
        console.log(`  Nome: ${user.metadata.name}`);
      }
    }
    
    return users;
  }

  /**
   * Remove um usuário do sistema
   */
  async removeUser(userId) {
    const removed = await this.database.removeUser(userId);
    if (removed) {
      console.log(`✅ Usuário ${userId} removido com sucesso!`);
    } else {
      console.log(`❌ Usuário ${userId} não encontrado.`);
    }
    return removed;
  }
}

// Exemplo de uso do sistema com MongoDB
async function demonstrateMongoDBSystem() {
  console.log('🚀 Iniciando Sistema de Validação Facial com MongoDB\n');
  
  const validationSystem = new FaceValidationSystem();
  
  try {
    // Carrega modelos
    console.log('Carregando modelos...');
    await faceDetectionNet.loadFromDisk('../../weights');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('../../weights');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('../../weights');
    console.log('✅ Modelos carregados!\n');

    // Inicializa sistema
    await validationSystem.initialize();

    // 1. Cadastra usuários
    await validationSystem.registerUser('joao', '../images/bbt1.jpg', {
      name: 'João Silva',
      email: 'joao@email.com',
      role: 'admin'
    });

    await validationSystem.registerUser('maria', '../images/bbt2.jpg', {
      name: 'Maria Santos',
      email: 'maria@email.com',
      role: 'user'
    });

    // 2. Lista usuários cadastrados
    await validationSystem.listRegisteredUsers();

    // 3. Valida usuários
    await validationSystem.validateUser('joao', '../images/bbt1.jpg');
    await validationSystem.validateUser('maria', '../images/bbt2.jpg');

    // 4. Teste de reconhecimento facial
    await validationSystem.recognizeUser('../images/bbt1.jpg');

    // 5. Remove um usuário
    await validationSystem.removeUser('maria');
    await validationSystem.listRegisteredUsers();

  } catch (error) {
    console.error('Erro no sistema:', error.message);
  } finally {
    // Finaliza sistema
    await validationSystem.shutdown();
  }
}

// Executa o exemplo (requer MongoDB rodando)
// demonstrateMongoDBSystem();

console.log('📝 Para executar este exemplo:');
console.log('1. Instale MongoDB: brew install mongodb-community');
console.log('2. Inicie MongoDB: brew services start mongodb-community');
console.log('3. Instale dependência: npm install mongodb');
console.log('4. Descomente a linha: demonstrateMongoDBSystem();');
console.log('5. Execute: node faceValidationMongoDB.js');
