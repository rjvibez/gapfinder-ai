export interface DocumentChunk {
  chunk_index: number;
  page_number: number;
  content: string;
}

export interface TopicContextInfo {
  name?: string | null;
  module?: string | null;
  key_concepts?: string[] | null;
  definitions?: string[] | null;
  subtopics?: string[] | null;
  source_page_numbers?: number[] | null;
}

export interface RawGeneratedQuestion {
  prompt?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  explanation?: unknown;
  sourcePages?: unknown;
  sourcePageNumbers?: unknown;
  source_pages?: unknown;
  source_page_numbers?: unknown;
  page?: unknown;
  pageNumber?: unknown;
  supportingText?: unknown;
  evidenceText?: unknown;
  evidence?: unknown;
}

export interface ScoredChunkMatch {
  pages: number[];
  score: number;
  chunkIndices: number[];
}

export const MAX_CONTEXT_CHUNKS = 40;
export const MIN_MATCH_THRESHOLD = 200;

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "down", "during", "each", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its",
  "itself", "let's", "me", "more", "most", "my", "myself", "no", "nor", "not",
  "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
  "there", "these", "they", "this", "those", "through", "to", "too", "under",
  "until", "up", "very", "was", "wasn't", "we", "were", "weren't", "what",
  "when", "where", "which", "while", "who", "whom", "why", "with", "won't",
  "would", "you", "your", "yours", "yourself", "yourselves"
]);

/**
 * Normalizes equation symbols, arrows, conditions, and comparison operators across
 * mathematical, chemical, and biological notations.
 */
export function normalizeEquationText(str: string): string {
  return str
    .replace(/[—–-]{1,2}\s*\([^)]*\)\s*[-—–]*\s*>/g, " -> ")
    .replace(/[—–-]{1,2}\s*\[[^\]]*\]\s*[-—–]*\s*>/g, " -> ")
    .replace(/[—–-]+\s*>/g, " -> ")
    .replace(/→|➔|➜|➡/g, " -> ")
    .replace(/⇌|↔/g, " <-> ")
    .replace(/≤|<=/g, " <= ")
    .replace(/≥|>=/g, " >= ")
    .replace(/≠|!=/g, " != ");
}

/**
 * Normalizes text for robust quote matching across whitespace, quotation marks, punctuation,
 * and formatting differences.
 */
export function cleanTextForMatching(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, "")
    .replace(/(?<=\d),(?=\d)/g, "") // Remove commas inside numbers (e.g. 299,792,458 -> 299792458)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts non-stopword tokens of length >= 2 from text for conceptual verification.
 */
export function extractSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Merges two adjacent chunk texts, removing overlapping boundary words if chunking overlap was used.
 */
export function mergeOverlappingText(first: string, second: string): string {
  const cleanFirst = cleanTextForMatching(first);
  const cleanSecond = cleanTextForMatching(second);
  const firstWords = cleanFirst.split(" ");
  const secondWords = cleanSecond.split(" ");

  const maxOverlapWords = Math.min(firstWords.length, secondWords.length, 25);
  for (let count = maxOverlapWords; count >= 1; count--) {
    const endPhrase = firstWords.slice(-count).join(" ");
    const startPhrase = secondWords.slice(0, count).join(" ");
    if (endPhrase === startPhrase) {
      const remainingSecond = secondWords.slice(count).join(" ");
      return `${cleanFirst} ${remainingSecond}`;
    }
  }

  return `${cleanFirst} ${cleanSecond}`;
}

/**
 * Normalizes page numbers from various representations into sorted unique positive integers.
 */
export function normalizePageNumbers(raw: unknown): number[] {
  if (raw === null || raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const pages: number[] = [];
  for (const item of list) {
    let num: number;
    if (typeof item === "number") {
      num = item;
    } else if (typeof item === "string") {
      num = parseInt(item.trim(), 10);
    } else {
      continue;
    }
    if (!isNaN(num) && Number.isInteger(num) && num > 0 && !pages.includes(num)) {
      pages.push(num);
    }
  }
  return pages.sort((a, b) => a - b);
}

/**
 * Extracts the single most relevant sentence from a chunk content based on keyword overlap.
 */
export function extractSupportingSentence(content: string, keywords: string[]): string {
  if (!content) return "";
  const sentences = content.split(/(?<=[.?!])\s+/);
  let bestSentence = sentences[0] || content;
  let maxMatches = -1;

  for (const s of sentences) {
    const cleanS = cleanTextForMatching(s);
    let matches = 0;
    for (const kw of keywords) {
      if (cleanS.includes(kw)) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestSentence = s.trim();
    }
  }

  return bestSentence;
}

/**
 * Calculates a quantitative evidence match score between an evidence string and candidate text.
 *
 * Scoring tiers:
 * - >= 1000: Direct case-insensitive substring match
 * - >= 800: Normalized match (punctuation, symbols, whitespace collapsed) or equation normalized match
 * - 600-850: Multi-segment clause / equation phrase match
 * - 400-750: Dense phrase / n-gram sliding window match
 * - 200-399: Multi-token density and bigram confirmation
 * - < 200: Incidental keyword overlap or weak partial match (rejected)
 */
export function scoreEvidenceMatch(evidenceText: string, content: string): number {
  if (!evidenceText || !content) return 0;
  const rawEvidence = evidenceText.trim();
  const rawContent = content.trim();
  if (rawEvidence.length < 5 || rawContent.length < 5) return 0;

  // 1. Direct case-insensitive substring match (highest priority)
  if (rawContent.toLowerCase().includes(rawEvidence.toLowerCase())) {
    return 1000 + Math.min(rawEvidence.length, 200);
  }

  const cleanEvidence = cleanTextForMatching(rawEvidence);
  const cleanContent = cleanTextForMatching(rawContent);
  if (cleanEvidence.length < 6 || cleanContent.length < 6) return 0;

  // 2. Normalized match (punctuation/symbols/whitespace stripped)
  if (cleanContent.includes(cleanEvidence)) {
    return 800 + Math.min(cleanEvidence.length, 200);
  }

  // 3. Equation / Arrow normalized match
  const eqEvidence = cleanTextForMatching(normalizeEquationText(rawEvidence));
  const eqContent = cleanTextForMatching(normalizeEquationText(rawContent));
  if (eqEvidence.length >= 6 && eqContent.includes(eqEvidence)) {
    return 800 + Math.min(eqEvidence.length, 200);
  }

  // 4. Segment-based phrase matching (splits on punctuation, arrows, conditions)
  let segmentScore = 0;
  const rawSegments = rawEvidence
    .split(/[:;.\n\r()\[\]—–]+|->|→|<->|⇌|=|\+/g)
    .map((s) => cleanTextForMatching(s))
    .filter((s) => s.length >= 4);

  if (rawSegments.length >= 2) {
    let matchedSegments = 0;
    let totalSignificantWordsInMatchedSegments = 0;
    for (const seg of rawSegments) {
      if (cleanContent.includes(seg)) {
        matchedSegments++;
        totalSignificantWordsInMatchedSegments += seg
          .split(" ")
          .filter((w) => w.length >= 3).length;
      }
    }
    const segmentRatio = matchedSegments / rawSegments.length;
    if (segmentRatio >= 0.7 && totalSignificantWordsInMatchedSegments >= 3) {
      segmentScore = 650 + Math.round(segmentRatio * 200);
      // Reward distinctive structural anchors like equation, formula, law, theorem
      if (
        /\b(equation|formula|law|theorem|experiment|reaction)\b/i.test(rawEvidence) &&
        /\b(equation|formula|law|theorem|experiment|reaction)\b/i.test(rawContent)
      ) {
        segmentScore += 50;
      }
    }
  }

  // Extract significant words (length >= 3)
  const words = cleanEvidence.split(" ").filter((w) => w.length >= 3);
  if (words.length < 2) return Math.max(segmentScore, 0);

  let windowScore = 0;
  // 5. Dense sliding window phrase matching (4-word phrases)
  if (words.length >= 4) {
    const totalWindows = words.length - 3;
    let matchedWindows = 0;
    for (let i = 0; i <= totalWindows; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`;
      if (cleanContent.includes(phrase)) {
        matchedWindows++;
      }
    }
    const windowRatio = matchedWindows / totalWindows;
    if (windowRatio >= 0.35) {
      windowScore = 400 + Math.round(windowRatio * 350);
    }
  }

  // 6. Content token density and bigram matching
  const uniqueWords = [...new Set(words)];
  let matchedWordCount = 0;
  for (const w of uniqueWords) {
    if (cleanContent.includes(w)) {
      matchedWordCount++;
    }
  }
  const tokenRatio = matchedWordCount / uniqueWords.length;

  let bigramRatio = 0;
  if (words.length >= 3) {
    const totalBigrams = words.length - 1;
    let matchedBigrams = 0;
    for (let i = 0; i < totalBigrams; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (cleanContent.includes(bigram)) {
        matchedBigrams++;
      }
    }
    bigramRatio = matchedBigrams / totalBigrams;
  }

  let densityScore = 0;
  // High token overlap with bigram confirmation
  if (tokenRatio >= 0.65 && (bigramRatio >= 0.25 || uniqueWords.length >= 4)) {
    densityScore = 150 + Math.round(tokenRatio * 150) + Math.round(bigramRatio * 100);
  }

  return Math.max(segmentScore, windowScore, densityScore);
}

/**
 * Validates that candidate chunk content factually entails/supports the question and its correct answer.
 * Detects and rejects hallucinations where a question about concept A is paired with a quotation from concept B.
 */
export function validateEvidenceEntailment(
  question: RawGeneratedQuestion,
  chunkContent: string
): boolean {
  if (!chunkContent || typeof chunkContent !== "string") return false;

  const promptText = typeof question.prompt === "string" ? question.prompt.trim() : "";
  let correctAnswer = "";
  if (
    Array.isArray(question.options) &&
    typeof question.correctIndex === "number" &&
    question.correctIndex >= 0 &&
    question.correctIndex < question.options.length
  ) {
    correctAnswer = String(question.options[question.correctIndex] ?? "").trim();
  }

  // If question has neither prompt nor answer, cannot falsify entailment
  if (!promptText && !correctAnswer) return true;

  const cleanChunk = cleanTextForMatching(chunkContent);
  const chunkWords = cleanChunk.split(" ");

  const wordMatches = (target: string): boolean => {
    if (!target) return false;
    const cleanTarget = cleanTextForMatching(target);
    if (cleanChunk.includes(cleanTarget)) return true;
    const tTokens = extractSignificantTokens(target);
    if (tTokens.length === 0) return false;
    return tTokens.some((t) =>
      chunkWords.some((cw) => {
        if (cw === t) return true;
        if (cw.length >= 5 && t.length >= 5) {
          return cw.startsWith(t) || t.startsWith(cw);
        }
        return false;
      })
    );
  };

  // 1. Verify correct answer support
  let answerSupported = true;
  if (correctAnswer) {
    const isMeta = /^(none of the above|all of the above|both|neither)/i.test(correctAnswer);
    const isPureNumeric = /^[\d\s.,/*+-^%()=]+$/.test(correctAnswer);

    if (isMeta || isPureNumeric) {
      // For meta or numeric answers, verify at least 2 significant concepts from prompt or explanation
      const explanationText = typeof question.explanation === "string" ? question.explanation : "";
      const combined = `${promptText} ${explanationText}`;
      const concepts = extractSignificantTokens(combined);
      const matchedConcepts = concepts.filter((c) => wordMatches(c));
      answerSupported = matchedConcepts.length >= 2;
    } else {
      answerSupported = wordMatches(correctAnswer);
    }
  }

  // 2. Verify prompt topic overlap
  let promptSupported = true;
  if (promptText) {
    const promptTokens = extractSignificantTokens(promptText);
    if (promptTokens.length > 0) {
      promptSupported = promptTokens.some((t) => wordMatches(t));
    }
  }

  return answerSupported && promptSupported;
}

/**
 * Searches provided chunks to find a genuine chunk that factually supports the question and correct answer.
 * Used when the model's quoted supportingText is missing or fails entailment validation.
 */
export function findSupportingChunkForQuestion(
  question: RawGeneratedQuestion,
  chunks: DocumentChunk[]
): DocumentChunk | null {
  if (!chunks || chunks.length === 0) return null;

  let bestChunk: DocumentChunk | null = null;
  let bestScore = 0;

  const promptText = typeof question.prompt === "string" ? question.prompt : "";
  const promptTokens = extractSignificantTokens(promptText);

  let correctAnswer = "";
  if (
    Array.isArray(question.options) &&
    typeof question.correctIndex === "number" &&
    question.correctIndex >= 0 &&
    question.correctIndex < question.options.length
  ) {
    correctAnswer = String(question.options[question.correctIndex] ?? "");
  }
  const answerTokens = extractSignificantTokens(correctAnswer);
  const cleanAnswer = cleanTextForMatching(correctAnswer);

  for (const chunk of chunks) {
    if (!validateEvidenceEntailment(question, chunk.content)) {
      continue;
    }

    const cleanChunk = cleanTextForMatching(chunk.content);
    let score = 0;

    // Exact answer phrase match in chunk
    if (cleanAnswer.length >= 3 && cleanChunk.includes(cleanAnswer)) {
      score += 350;
    }

    // Answer token overlap
    for (const token of answerTokens) {
      if (cleanChunk.includes(token)) {
        score += 80;
      }
    }

    // Prompt token overlap
    for (const token of promptTokens) {
      if (cleanChunk.includes(token)) {
        score += 40;
      }
    }

    if (score > bestScore && score >= 250) {
      bestScore = score;
      bestChunk = chunk;
    }
  }

  return bestChunk;
}

/**
 * Evaluates and ranks evidence matches across both individual chunks and contiguous chunk pairs
 * (to cleanly detect evidence spanning chunk or page boundaries without polluting single-chunk matches).
 */
export function rankEvidenceMatches(
  text: string,
  chunks: DocumentChunk[]
): ScoredChunkMatch[] {
  if (!text || typeof text !== "string" || chunks.length === 0) return [];
  const matches: ScoredChunkMatch[] = [];

  const individualScores = new Map<number, number>();

  // 1. Score individual chunks
  for (const chunk of chunks) {
    const score = scoreEvidenceMatch(text, chunk.content);
    individualScores.set(chunk.chunk_index, score);
    if (score >= MIN_MATCH_THRESHOLD) {
      matches.push({
        pages: [chunk.page_number],
        score,
        chunkIndices: [chunk.chunk_index],
      });
    }
  }

  // 2. Score contiguous chunk pairs to detect evidence spanning across chunk/page boundaries
  for (let i = 0; i < chunks.length - 1; i++) {
    const first = chunks[i];
    const second = chunks[i + 1];
    if (second.chunk_index === first.chunk_index + 1) {
      const firstScore = individualScores.get(first.chunk_index) || 0;
      const secondScore = individualScores.get(second.chunk_index) || 0;
      const maxIndividual = Math.max(firstScore, secondScore);

      // Only evaluate pair if neither chunk alone is already an exact match of the entire quote
      if (maxIndividual < 1000) {
        const combinedContent = mergeOverlappingText(first.content, second.content);
        const score = scoreEvidenceMatch(text, combinedContent);
        if (score >= MIN_MATCH_THRESHOLD && score > maxIndividual + 30) {
          const pages = [
            ...new Set([first.page_number, second.page_number]),
          ].sort((a, b) => a - b);

          matches.push({
            pages,
            score,
            chunkIndices: [first.chunk_index, second.chunk_index],
          });
        }
      }
    }
  }

  // Sort by match score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Matches supporting text to document chunks, returning the matching chunks sorted by score.
 */
export function matchSupportingTextToChunks(
  text: string,
  chunks: DocumentChunk[]
): DocumentChunk[] {
  const ranked = rankEvidenceMatches(text, chunks);
  if (ranked.length === 0) return [];

  const topScore = ranked[0].score;
  const topMatches = ranked.filter((m) => m.score >= topScore * 0.85);
  const matchedIndices = new Set(topMatches.flatMap((m) => m.chunkIndices));
  return chunks.filter((c) => matchedIndices.has(c.chunk_index));
}

/**
 * Selects bounded context chunks for prompt generation.
 * For small documents (<= maxChunks), preserves all chunks to give complete context.
 * For larger documents, prioritizes topic-referenced pages, adjacent pages, and keyword matches.
 */
export function selectContextChunks(
  chunks: DocumentChunk[],
  topic: TopicContextInfo,
  maxChunks: number = MAX_CONTEXT_CHUNKS
): DocumentChunk[] {
  if (chunks.length <= maxChunks) {
    return chunks;
  }

  const topicPages = new Set(
    Array.isArray(topic.source_page_numbers)
      ? topic.source_page_numbers.filter((p): p is number => typeof p === "number" && p > 0)
      : []
  );

  const adjacentPages = new Set<number>();
  for (const p of topicPages) {
    if (p > 1) adjacentPages.add(p - 1);
    adjacentPages.add(p + 1);
  }

  const keywords = new Set<string>();
  const addKeywords = (text?: string | null) => {
    if (!text) return;
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4)
      .forEach((w) => keywords.add(w));
  };
  addKeywords(topic.name);
  topic.key_concepts?.forEach(addKeywords);
  topic.definitions?.forEach(addKeywords);
  topic.subtopics?.forEach(addKeywords);

  const scored = chunks.map((chunk) => {
    let score = 0;
    if (topicPages.has(chunk.page_number)) {
      score += 10;
    } else if (adjacentPages.has(chunk.page_number)) {
      score += 5;
    }

    const contentLower = chunk.content.toLowerCase();
    for (const kw of keywords) {
      if (contentLower.includes(kw)) {
        score += 2;
      }
    }

    return { chunk, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chunk.chunk_index - b.chunk.chunk_index;
  });

  const selected = scored.slice(0, maxChunks).map((s) => s.chunk);
  selected.sort((a, b) => a.chunk_index - b.chunk_index);
  return selected;
}

/**
 * Resolves and validates question citations against actual document chunks.
 *
 * Grounding rules:
 * 1. Verified document evidence is the authoritative source of truth. Unverified model page
 *    suggestions never override verified document chunk pages.
 * 2. Matches are scored and ranked: exact, normalized, and equation matches take strict precedence over partial overlap.
 * 3. Evidence-answer validation verifies that the matched evidence chunk actually supports the question and correct answer.
 * 4. Hallucinated or disconnected quotations are rejected, and genuine supporting chunks are recovered if present.
 * 5. Returns [] when evidence cannot be verified against the material. Never fabricates.
 * 6. Enforces strict material and user isolation by validating against provided chunks only.
 */
export function resolveQuestionCitation(
  q: RawGeneratedQuestion,
  providedChunks: DocumentChunk[]
): {
  sourcePages: number[];
  supportingText?: string;
} {
  const validChunkPages = new Set(providedChunks.map((c) => c.page_number));

  // 1. Extract raw supporting text from the model response
  const rawSupportingText =
    typeof q.supportingText === "string"
      ? q.supportingText.trim()
      : typeof q.evidenceText === "string"
      ? q.evidenceText.trim()
      : typeof q.evidence === "string"
      ? q.evidence.trim()
      : "";

  // 2. Score and rank evidence matches across provided document chunks
  const rankedMatches = rawSupportingText
    ? rankEvidenceMatches(rawSupportingText, providedChunks)
    : [];

  if (rankedMatches.length > 0) {
    const topMatch = rankedMatches[0];
    const topScore = topMatch.score;

    if (topScore >= MIN_MATCH_THRESHOLD) {
      // Find chunk content corresponding to top match
      const matchedChunks = providedChunks.filter((c) =>
        topMatch.chunkIndices.includes(c.chunk_index)
      );
      const combinedMatchedContent =
        matchedChunks.length > 1
          ? mergeOverlappingText(matchedChunks[0].content, matchedChunks[1].content)
          : matchedChunks[0]?.content || "";

      // Verify evidence grounding / entailment with the question and correct answer
      if (validateEvidenceEntailment(q, combinedMatchedContent)) {
        const topMatches = rankedMatches.filter(
          (m) => m.score >= Math.max(topScore * 0.85, MIN_MATCH_THRESHOLD)
        );

        const verifiedPages = [
          ...new Set(topMatches.flatMap((m) => m.pages)),
        ]
          .filter((p) => validChunkPages.has(p))
          .sort((a, b) => a - b);

        if (verifiedPages.length > 0) {
          return {
            sourcePages: verifiedPages,
            supportingText: rawSupportingText,
          };
        }
      }
      // If the top match failed entailment, the quotation was disconnected (e.g. pondweed quote for xylem question)
      // Fall through to find genuine supporting chunk for the question + answer
    }
  }

  // 3. Fallback / Recovery: Search for a genuine supporting chunk in the document that validly grounds the question
  const genuineChunk = findSupportingChunkForQuestion(q, providedChunks);
  if (genuineChunk && validChunkPages.has(genuineChunk.page_number)) {
    const promptText = typeof q.prompt === "string" ? q.prompt : "";
    let correctAnswer = "";
    if (
      Array.isArray(q.options) &&
      typeof q.correctIndex === "number" &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length
    ) {
      correctAnswer = String(q.options[q.correctIndex] ?? "");
    }
    const keywords = [
      ...extractSignificantTokens(correctAnswer),
      ...extractSignificantTokens(promptText),
    ];
    const recoveredQuote = extractSupportingSentence(genuineChunk.content, keywords);

    return {
      sourcePages: [genuineChunk.page_number],
      supportingText: recoveredQuote,
    };
  }

  // 4. Evidence could not be verified against any document chunk:
  // Never fabricate or guess a citation. Return no citation.
  return {
    sourcePages: [],
    supportingText: undefined,
  };
}
