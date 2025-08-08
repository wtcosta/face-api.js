# Hash Facial - Face-API.js

Este projeto demonstra como gerar hashes únicos que representam características faciais usando a biblioteca face-api.js.

## Funcionalidades

### 1. Detecção de Face em Tempo Real
- Detecta faces através da webcam
- Extrai landmarks faciais (68 pontos)
- Gera descriptors faciais (128 valores)

### 2. Geração de Hash Facial
- **Hash Simples**: Algoritmo personalizado baseado em valores do descriptor
- **SHA-256**: Hash criptográfico SHA-256
- **MD5**: Hash criptográfico MD5
- **Base64**: Codificação Base64 do descriptor
- **Hexadecimal**: Conversão direta para hexadecimal

### 3. Configurações de Hash
- **Comprimento**: 16, 32, 64 caracteres ou completo
- **Tipo**: Seleção entre diferentes algoritmos de hash
- **Histórico**: Salvamento e visualização de hashes anteriores

## Como Usar

### Interface Web (Browser)

1. **Acesse o arquivo**: `examples/examples-browser/views/webcamFaceHash.html`

2. **Permita acesso à câmera** quando solicitado

3. **Configure o hash**:
   - Selecione o tipo de hash desejado
   - Escolha o comprimento do hash
   - O hash será atualizado automaticamente

4. **Funcionalidades disponíveis**:
   - **Copiar Hash**: Copia o hash atual para a área de transferência
   - **Salvar Hash**: Salva o hash no histórico local
   - **Histórico**: Visualiza hashes salvos anteriormente

### Exemplo Node.js

1. **Navegue até o diretório**: `examples/examples-nodejs/`

2. **Execute o exemplo**:
   ```bash
   npm install
   npx ts-node faceHash.ts
   ```

3. **Resultados**:
   - Hashes são exibidos no console
   - Arquivo JSON com resultados é salvo em `out/faceHashResults.json`

## Estrutura do Hash

### Descriptor Facial
O descriptor facial é um array de 128 valores float que representam características únicas do rosto:
```javascript
// Exemplo de descriptor (primeiros 10 valores)
[0.123, -0.456, 0.789, -0.321, 0.654, -0.987, 0.234, -0.567, 0.890, -0.123, ...]
```

### Tipos de Hash

#### 1. Hash Simples
```javascript
// Algoritmo personalizado que combina:
// - Hash baseado em string do descriptor
// - Valores hexadecimais dos primeiros 16 valores
// Resultado: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

#### 2. SHA-256
```javascript
// Hash criptográfico SHA-256
// Resultado: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

#### 3. MD5
```javascript
// Hash criptográfico MD5
// Resultado: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4"
```

#### 4. Base64
```javascript
// Codificação Base64 do descriptor
// Resultado: "MTIzLC00NTYsNzg5LC0zMjEsNjU0LC05ODcsMjM0LC01NjcsODkwLC0xMjMs..."
```

#### 5. Hexadecimal
```javascript
// Conversão direta para hexadecimal
// Resultado: "0000007b000001c8000003150000014100000028a000003d90000000ea000001c7000003780000007b..."
```

## Aplicações

### 1. Identificação Única
- Cada pessoa tem um hash único baseado em suas características faciais
- Útil para sistemas de identificação e autenticação

### 2. Comparação de Similaridade
- Compare hashes para determinar se duas faces são da mesma pessoa
- Implemente sistemas de reconhecimento facial

### 3. Armazenamento Seguro
- Hash pode ser usado como identificador único sem armazenar dados biométricos
- Reduz riscos de privacidade

### 4. Verificação de Integridade
- Use hashes para verificar se uma face foi alterada ou manipulada
- Aplicações em segurança e forense

## Exemplo de Código

### Browser (JavaScript)
```javascript
// Detectar face e gerar hash
const result = await faceapi.detectSingleFace(video)
  .withFaceLandmarks()
  .withFaceDescriptor()

if (result) {
  const hash = generateFaceHash(result.descriptor, {
    type: 'sha256',
    length: 32
  })
  console.log('Hash facial:', hash)
}
```

### Node.js (TypeScript)
```typescript
// Gerar hash usando a classe FaceHashGenerator
const hash = FaceHashGenerator.generateFaceHash(descriptor, {
  type: 'sha256',
  length: 32
})

// Comparar hashes
const similarity = FaceHashGenerator.compareHashes(hash1, hash2)
```

## Considerações de Segurança

1. **Privacidade**: Hashes não podem ser revertidos para reconstruir o rosto original
2. **Unicidade**: Cada pessoa tem características faciais únicas
3. **Consistência**: O mesmo rosto sempre gera o mesmo hash (com pequenas variações)
4. **Armazenamento**: Armazene apenas hashes, nunca descriptors completos

## Limitações

1. **Variações**: Mudanças na iluminação, ângulo ou expressão podem afetar o hash
2. **Precisão**: Depende da qualidade da detecção facial
3. **Performance**: Geração de hash pode ser computacionalmente intensiva
4. **Compatibilidade**: Diferentes versões do modelo podem gerar hashes diferentes

## Dependências

- face-api.js: Detecção e análise facial
- crypto-js (browser): Algoritmos criptográficos
- crypto (Node.js): Algoritmos criptográficos nativos
- Materialize CSS: Interface de usuário

## Licença

Este projeto segue a mesma licença do face-api.js.
