const faceapi = require('face-api.js');
const crypto = require('crypto');
import { canvas, faceDetectionNet, faceDetectionOptions, saveFile } from './commons';

const IMAGE_PATH = '../images/bbt1.jpg'

interface HashOptions {
  type: 'simple' | 'sha256' | 'md5' | 'base64' | 'hex';
  length?: number;
}

class FaceHashGenerator {
  
  /**
   * Gera um hash simples baseado no descriptor facial
   */
  static generateSimpleHash(descriptor: Float32Array): string {
    const descriptorString = Array.from(descriptor).join(',')
    let hash = 0
    
    for (let i = 0; i < descriptorString.length; i++) {
      const char = descriptorString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Converte para 32-bit integer
    }
    
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0')
    const additionalHash = descriptor.slice(0, 16).reduce((acc, val, idx) => {
      return acc + (Math.abs(val * 1000) % 256).toString(16).padStart(2, '0')
    }, '')
    
    return `${hexHash}${additionalHash}`
  }

  /**
   * Gera um hash SHA-256 baseado no descriptor facial
   */
  static generateSHA256Hash(descriptor: Float32Array): string {
    const descriptorString = Array.from(descriptor).join(',')
    return crypto.createHash('sha256').update(descriptorString).digest('hex')
  }

  /**
   * Gera um hash MD5 baseado no descriptor facial
   */
  static generateMD5Hash(descriptor: Float32Array): string {
    const descriptorString = Array.from(descriptor).join(',')
    return crypto.createHash('md5').update(descriptorString).digest('hex')
  }

  /**
   * Gera um hash Base64 baseado no descriptor facial
   */
  static generateBase64Hash(descriptor: Float32Array): string {
    const descriptorString = Array.from(descriptor).join(',')
    return Buffer.from(descriptorString).toString('base64')
  }

  /**
   * Gera um hash hexadecimal baseado no descriptor facial
   */
  static generateHexHash(descriptor: Float32Array): string {
    return Array.from(descriptor).map(val => 
      Math.abs(val * 1000).toString(16).padStart(4, '0')
    ).join('')
  }

  /**
   * Gera um hash facial baseado no tipo especificado
   */
  static generateFaceHash(descriptor: Float32Array, options: HashOptions = { type: 'simple' }): string {
    let hash: string

    switch (options.type) {
      case 'simple':
        hash = this.generateSimpleHash(descriptor)
        break
      case 'sha256':
        hash = this.generateSHA256Hash(descriptor)
        break
      case 'md5':
        hash = this.generateMD5Hash(descriptor)
        break
      case 'base64':
        hash = this.generateBase64Hash(descriptor)
        break
      case 'hex':
        hash = this.generateHexHash(descriptor)
        break
      default:
        hash = this.generateSimpleHash(descriptor)
    }

    // Aplica o comprimento se especificado
    if (options.length && hash.length > options.length) {
      hash = hash.substring(0, options.length)
    }

    return hash
  }

  /**
   * Compara dois hashes faciais e retorna a similaridade
   */
  static compareHashes(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0
    }

    let matches = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) {
        matches++
      }
    }

    return matches / hash1.length
  }

  /**
   * Gera múltiplos tipos de hash para um descriptor
   */
  static generateAllHashes(descriptor: Float32Array): Record<string, string> {
    return {
      simple: this.generateSimpleHash(descriptor),
      sha256: this.generateSHA256Hash(descriptor),
      md5: this.generateMD5Hash(descriptor),
      base64: this.generateBase64Hash(descriptor),
      hex: this.generateHexHash(descriptor)
    }
  }
}

async function run() {
  console.log('Carregando modelos...')
  
  await faceDetectionNet.loadFromDisk('../../weights')
  await faceapi.nets.faceLandmark68Net.loadFromDisk('../../weights')
  await faceapi.nets.faceRecognitionNet.loadFromDisk('../../weights')

  console.log('Carregando imagem...')
  const image = await canvas.loadImage(IMAGE_PATH)

  console.log('Detectando face e gerando descriptor...')
  const result = await faceapi.detectSingleFace(image, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!result) {
    console.log('Nenhuma face detectada na imagem')
    return
  }

  console.log('Face detectada! Gerando hashes...')
  console.log('Descriptor length:', result.descriptor.length)
  console.log('Primeiros 10 valores do descriptor:', result.descriptor.slice(0, 10))

  // Gera todos os tipos de hash
  const allHashes = FaceHashGenerator.generateAllHashes(result.descriptor)
  
  console.log('\n=== HASHS FACIAIS ===')
  console.log('Hash Simples:', allHashes.simple)
  console.log('SHA-256:', allHashes.sha256)
  console.log('MD5:', allHashes.md5)
  console.log('Base64:', allHashes.base64)
  console.log('Hexadecimal:', allHashes.hex)

  // Gera hashes com diferentes comprimentos
  console.log('\n=== HASHS COM DIFERENTES COMPRIMENTOS ===')
  const hashTypes: Array<'simple' | 'sha256' | 'md5' | 'base64' | 'hex'> = ['simple', 'sha256', 'md5', 'base64', 'hex']
  
  for (const type of hashTypes) {
    console.log(`\n${type.toUpperCase()}:`)
    for (const length of [16, 32, 64]) {
      const hash = FaceHashGenerator.generateFaceHash(result.descriptor, { type, length })
      console.log(`  ${length} chars: ${hash}`)
    }
  }

  // Salva os resultados em um arquivo JSON
  const results = {
    image: IMAGE_PATH,
    timestamp: new Date().toISOString(),
    descriptor: Array.from(result.descriptor),
    hashes: allHashes,
    hashesWithLengths: hashTypes.reduce((acc, type) => {
      acc[type] = {
        16: FaceHashGenerator.generateFaceHash(result.descriptor, { type, length: 16 }),
        32: FaceHashGenerator.generateFaceHash(result.descriptor, { type, length: 32 }),
        64: FaceHashGenerator.generateFaceHash(result.descriptor, { type, length: 64 })
      }
      return acc
    }, {} as Record<string, Record<number, string>>)
  }

  saveFile('faceHashResults.json', Buffer.from(JSON.stringify(results, null, 2)))
  console.log('\nResultados salvos em out/faceHashResults.json')

  // Demonstração de comparação de hashes
  console.log('\n=== DEMONSTRAÇÃO DE COMPARAÇÃO ===')
  const hash1 = FaceHashGenerator.generateFaceHash(result.descriptor, { type: 'simple', length: 32 })
  const hash2 = FaceHashGenerator.generateFaceHash(result.descriptor, { type: 'simple', length: 32 })
  
  console.log('Hash 1:', hash1)
  console.log('Hash 2:', hash2)
  console.log('Similaridade:', FaceHashGenerator.compareHashes(hash1, hash2))

  console.log('\nProcesso concluído!')
}

run()
