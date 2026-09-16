/**
 * काव्यकलश (KavyaVault) — Vector Mathematics & Similarity (vectorMath.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Deterministic vector mathematics for cosine similarity and normalization.
 */

import { validateEmbeddingVector } from './semanticTypes.js';

/**
 * Computes the Euclidean magnitude (L2 norm) of a vector: sqrt(sum(v_i^2)).
 *
 * @param {Array<number>|Float32Array|Float64Array} vector
 * @returns {number}
 */
export function vectorMagnitude(vector) {
  validateEmbeddingVector(vector);

  let sumSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    sumSquares += val * val;
  }

  return Math.sqrt(sumSquares);
}

/**
 * Normalizes a vector to unit length (L2 norm = 1.0).
 * If magnitude is 0 (zero vector), returns a clean zero vector of the same dimension.
 *
 * @param {Array<number>|Float32Array|Float64Array} vector
 * @returns {Array<number>} Normalized vector
 */
export function normalizeVector(vector) {
  validateEmbeddingVector(vector);

  const mag = vectorMagnitude(vector);
  if (mag === 0) {
    return new Array(vector.length).fill(0);
  }

  const result = new Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] / mag;
  }

  return result;
}

/**
 * Computes the dot product of two vectors: sum(a_i * b_i).
 *
 * @param {Array<number>|Float32Array|Float64Array} vecA
 * @param {Array<number>|Float32Array|Float64Array} vecB
 * @returns {number}
 */
export function dotProduct(vecA, vecB) {
  validateEmbeddingVector(vecA);
  validateEmbeddingVector(vecB);

  if (vecA.length !== vecB.length) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += vecA[i] * vecB[i];
  }

  return sum;
}

/**
 * Computes the cosine similarity between two numerical vectors.
 * Formula: (A · B) / (||A|| * ||B||)
 *
 * Requirements:
 * - Deterministic output.
 * - Dimension mismatch handled safely (returns 0).
 * - Zero vectors handled safely (returns 0).
 * - NaN / Infinity values rejected via validateEmbeddingVector.
 * - Result bounded strictly to [-1.0, 1.0].
 *
 * @param {Array<number>|Float32Array|Float64Array} vecA
 * @param {Array<number>|Float32Array|Float64Array} vecB
 * @returns {number} Cosine similarity bounded in [-1.0, 1.0]
 */
export function cosineSimilarity(vecA, vecB) {
  validateEmbeddingVector(vecA);
  validateEmbeddingVector(vecB);

  // Safe dimension mismatch handling
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  // Safe zero-vector handling
  if (magA === 0 || magB === 0) {
    return 0;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) {
    return 0;
  }

  let similarity = dot / denom;

  // Bound within mathematical range [-1.0, 1.0] to compensate for floating-point inaccuracies
  if (similarity > 1.0) similarity = 1.0;
  if (similarity < -1.0) similarity = -1.0;

  return similarity;
}
