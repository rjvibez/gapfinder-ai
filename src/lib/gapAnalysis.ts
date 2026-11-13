/**
 * Evidence-Grounded Gap Analysis & Error Pattern Analyzer
 *
 * Analyzes incorrect quiz answers using question prompts, selected vs. correct
 * answers, explanations, citations, and mapped topic syllabus metadata to group
 * mistakes into meaningful conceptual gaps.
 */

export interface ConceptualGap {
  id: string;
  concept: string;
  problem: string;
  recommendedAction: string;
  sourceCitation: string;
  sourcePageNumbers: number[];
  mistakeCount: number;
  questions: string[];
  isFallback?: boolean;
}

export interface IncorrectAnswerInput {
  questionId?: string;
  prompt: string;
  selectedOption?: number;
  selectedAnswerText?: string;
  correctOption?: number;
  correctAnswerText?: string;
  isCorrect?: boolean;
  explanation?: string;
  sourcePages?: number[];
  supportingText?: string;
}

export interface TopicContextInput {
  name: string;
  keyConcepts?: string[];
  subtopics?: string[];
  definitions?: string[];
  evidenceText?: string;
  sourcePageNumbers?: number[];
}

/**
 * Derives a beginner-friendly problem statement from the question, concept, and explanation.
 */
function deriveProblemStatement(
  prompt: string,
  concept: string,
  explanation?: string,
  selectedText?: string,
  correctText?: string
): string {
  const cleanPrompt = prompt.trim();

  // Pattern: "Which item is NOT one of the four stages of the information-processing cycle?"
  const notOneOfMatch = cleanPrompt.match(
    /\b(?:is|are)\s+NOT\s+(?:one\s+of\s+)?(?:the\s+)?([a-zA-Z0-9\s-]{3,40}?)(?:\s+(?:of|in|for)\b|\?|$)/i
  );
  if (notOneOfMatch && notOneOfMatch[1]) {
    const target = notOneOfMatch[1].trim();
    return `Unable to distinguish the ${target}.`;
  }

  // Pattern: "Which of the following is NOT..."
  const generalNotMatch = cleanPrompt.match(
    /\b(?:is|are)\s+NOT\s+(?:a|an|the)?\s*([a-zA-Z0-9\s-]{3,35}?)(?:\s+(?:of|in|for)\b|\?|$)/i
  );
  if (generalNotMatch && generalNotMatch[1]) {
    return `Unable to distinguish valid ${generalNotMatch[1].trim()}.`;
  }

  // Pattern: "What is the primary function / purpose / role of X?"
  const purposeMatch = cleanPrompt.match(
    /\b(?:primary|main|core)\s+(?:function|purpose|role|objective)\s+of\s+([a-zA-Z0-9\s-]{3,40}?)(?:\s+(?:in|for)\b|\?|$)/i
  );
  if (purposeMatch && purposeMatch[1]) {
    return `Unclear on the primary purpose of ${purposeMatch[1].trim()}.`;
  }

  // Pattern: "Which component / element is responsible for X?"
  const responsibleMatch = cleanPrompt.match(
    /\b(?:responsible\s+for|used\s+to|designed\s+to)\s+([a-zA-Z0-9\s-]{4,50}?)(?:\s+(?:in|for)\b|\?|$)/i
  );
  if (responsibleMatch && responsibleMatch[1]) {
    return `Unable to identify mechanism for ${responsibleMatch[1].trim()}.`;
  }

  // Pattern: "Define X" or "What is X?"
  const whatIsMatch = cleanPrompt.match(
    /^(?:what\s+is|define)\s+(?:a|an|the)?\s*([a-zA-Z0-9\s-]{3,35}?)(?:\s+(?:in|for)\b|\?|$)/i
  );
  if (whatIsMatch && whatIsMatch[1]) {
    return `Difficulty recalling the definition and core role of ${whatIsMatch[1].trim()}.`;
  }

  // Use student choice vs correct answer if clear
  if (
    selectedText &&
    correctText &&
    selectedText !== "No answer selected" &&
    selectedText !== correctText
  ) {
    return `Selected "${selectedText.slice(0, 35)}" instead of "${correctText.slice(0, 35)}".`;
  }

  // Use explanation if informative
  if (explanation && explanation.length > 15) {
    const firstSentence = explanation.split(/[.?!]/)[0].trim();
    if (firstSentence.length > 10 && firstSentence.length < 90) {
      return `Misunderstanding: ${firstSentence}.`;
    }
  }

  if (concept && concept !== "General Understanding") {
    return `Confusion regarding key properties of ${concept}.`;
  }

  return "Unable to identify the correct concept on the assessment.";
}

/**
 * Derives a recommended action grounded in uploaded material.
 */
function deriveRecommendedAction(
  concept: string,
  problem: string,
  sourceCitation: string
): string {
  // If problem specifies a sub-item like "the four stages"
  const fourStagesMatch = problem.match(/Unable to distinguish the ([a-zA-Z0-9\s-]+)\./i);
  if (fourStagesMatch && fourStagesMatch[1]) {
    const target = fourStagesMatch[1].trim();
    return `Review the ${target} in the uploaded material${sourceCitation ? ` (${sourceCitation})` : ""}.`;
  }

  if (concept && concept !== "General Understanding") {
    return `Review ${concept} in the uploaded material${sourceCitation ? ` (${sourceCitation})` : ""}.`;
  }

  return `Review relevant sections in the uploaded study material${sourceCitation ? ` (${sourceCitation})` : ""}.`;
}

/**
 * Formats page citations nicely: e.g. "Page 1", "Pages 1, 2".
 */
export function formatSourceCitation(pageNumbers?: number[]): string {
  if (!pageNumbers || pageNumbers.length === 0) return "";
  const sorted = Array.from(new Set(pageNumbers.filter((n) => typeof n === "number" && !isNaN(n) && n > 0))).sort(
    (a, b) => a - b
  );
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `Page ${sorted[0]}`;
  return `Pages ${sorted.join(", ")}`;
}

/**
 * Deterministically analyzes missed answers against topic concepts and citations.
 */
export function identifyConceptualGaps(
  missedAnswers: IncorrectAnswerInput[],
  topic: TopicContextInput
): ConceptualGap[] {
  if (!missedAnswers || missedAnswers.length === 0) return [];

  const availableConcepts: string[] = [
    ...(topic.keyConcepts || []),
    ...(topic.subtopics || []),
  ].filter((c) => typeof c === "string" && c.trim().length > 1);

  // Concept Key -> ConceptualGap accumulator
  const gapMap = new Map<
    string,
    {
      concept: string;
      problems: string[];
      recommendedActions: string[];
      sourcePageNumbers: Set<number>;
      questions: string[];
      isFallback: boolean;
    }
  >();

  for (const item of missedAnswers) {
    const promptText = (item.prompt || "").trim();
    if (!promptText) continue;

    const lowerPrompt = promptText.toLowerCase();
    const lowerExplanation = (item.explanation || "").toLowerCase();
    const lowerSupporting = (item.supportingText || "").toLowerCase();
    const combinedContext = `${lowerPrompt} ${lowerExplanation} ${lowerSupporting}`;

    // 1. Find matching concept in mapped syllabus
    let matchedConcept: string | null = null;
    let highestOverlap = 0;

    for (const concept of availableConcepts) {
      const cleanConcept = concept.trim();
      const lowerConcept = cleanConcept.toLowerCase();

      // Exact substring match
      if (lowerPrompt.includes(lowerConcept)) {
        const score = lowerConcept.length * 2; // prioritize longer, more specific phrases
        if (score > highestOverlap) {
          highestOverlap = score;
          matchedConcept = cleanConcept;
        }
      } else if (combinedContext.includes(lowerConcept)) {
        const score = lowerConcept.length;
        if (score > highestOverlap) {
          highestOverlap = score;
          matchedConcept = cleanConcept;
        }
      }
    }

    // Check definitions if no concept matched yet
    if (!matchedConcept && topic.definitions && topic.definitions.length > 0) {
      for (const def of topic.definitions) {
        const term = def.split(/[:–-]/)[0]?.trim();
        if (term && term.length > 2 && lowerPrompt.includes(term.toLowerCase())) {
          matchedConcept = term;
          break;
        }
      }
    }

    const isFallback = !matchedConcept;
    const finalConceptName = matchedConcept || topic.name || "General Understanding";

    // 2. Resolve source pages for this mistake
    const pagesForThisMistake: number[] = [];
    if (Array.isArray(item.sourcePages) && item.sourcePages.length > 0) {
      pagesForThisMistake.push(...item.sourcePages);
    } else if (Array.isArray(topic.sourcePageNumbers) && topic.sourcePageNumbers.length > 0) {
      pagesForThisMistake.push(...topic.sourcePageNumbers);
    }

    // 3. Problem and action
    const problem = deriveProblemStatement(
      promptText,
      finalConceptName,
      item.explanation,
      item.selectedAnswerText,
      item.correctAnswerText
    );

    const citationText = formatSourceCitation(pagesForThisMistake);
    const action = deriveRecommendedAction(finalConceptName, problem, citationText);

    // Grouping key: normalize concept name so repeated mistakes fall into same bucket
    const groupKey = isFallback ? `fallback_${promptText.slice(0, 40)}` : finalConceptName.toLowerCase();

    const existing = gapMap.get(groupKey);
    if (existing) {
      existing.problems.push(problem);
      existing.recommendedActions.push(action);
      existing.questions.push(promptText);
      for (const p of pagesForThisMistake) existing.sourcePageNumbers.add(p);
    } else {
      gapMap.set(groupKey, {
        concept: finalConceptName,
        problems: [problem],
        recommendedActions: [action],
        sourcePageNumbers: new Set(pagesForThisMistake),
        questions: [promptText],
        isFallback,
      });
    }
  }

  // Convert accumulated map to ConceptualGap list
  const results: ConceptualGap[] = [];
  let index = 1;

  for (const [, entry] of gapMap.entries()) {
    const pageList = Array.from(entry.sourcePageNumbers).sort((a, b) => a - b);
    const citation = formatSourceCitation(pageList);

    // Pick most specific problem statement
    const primaryProblem =
      entry.problems.find((p) => !p.startsWith("Selected ") && !p.startsWith("Unable to identify")) ||
      entry.problems[0] ||
      "Unable to distinguish key concept characteristics.";

    const primaryAction =
      entry.recommendedActions.find((a) => a.includes("in the uploaded material")) ||
      entry.recommendedActions[0] ||
      `Review ${entry.concept} in the study material.`;

    results.push({
      id: `gap-${index++}`,
      concept: entry.concept,
      problem: primaryProblem,
      recommendedAction: primaryAction,
      sourceCitation: citation,
      sourcePageNumbers: pageList,
      mistakeCount: entry.questions.length,
      questions: Array.from(new Set(entry.questions)),
      isFallback: entry.isFallback,
    });
  }

  // Sort: non-fallback with highest mistake counts first
  return results.sort((a, b) => {
    if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
    return b.mistakeCount - a.mistakeCount;
  });
}

/**
 * Extracts and reconstructs conceptual gaps from a topic's stored errorPattern
 * (supporting both new JSON format and legacy "Missed X... Review: Question 1 | Question 2" string format).
 */
export function extractConceptualGapsFromTopic(topic: {
  errorPattern?: string;
  name: string;
  keyConcepts?: string[];
  subtopics?: string[];
  definitions?: string[];
  evidenceText?: string;
  sourcePageNumbers?: number[];
}): ConceptualGap[] {
  if (!topic.errorPattern || topic.errorPattern.trim().length === 0) {
    return [];
  }

  const raw = topic.errorPattern.trim();

  // 1. Try parsing modern JSON structure
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.gaps) && parsed.gaps.length > 0) {
        return parsed.gaps.map((rawGap: unknown, idx: number) => {
          const g = (rawGap && typeof rawGap === "object" ? rawGap : {}) as Record<string, unknown>;
          return {
            id: String(g.id || `gap-${idx + 1}`),
            concept: String(g.concept || topic.name || "Identified Gap"),
            problem: String(g.problem || "Conceptual challenge detected"),
            recommendedAction: String(
              g.recommendedAction || `Review in study material.`
            ),
            sourceCitation: String(
              g.sourceCitation ||
                formatSourceCitation(
                  (Array.isArray(g.sourcePageNumbers) ? g.sourcePageNumbers : topic.sourcePageNumbers) as number[]
                )
            ),
            sourcePageNumbers: Array.isArray(g.sourcePageNumbers)
              ? (g.sourcePageNumbers as unknown[]).map(Number)
              : topic.sourcePageNumbers || [],
            mistakeCount:
              typeof g.mistakeCount === "number" && g.mistakeCount > 0
                ? g.mistakeCount
                : 1,
            questions: Array.isArray(g.questions)
              ? (g.questions as unknown[]).map(String)
              : [],
            isFallback: Boolean(g.isFallback),
          };
        });
      }
    } catch {
      // Fallback to legacy string parsing
    }
  }

  // 2. Parse legacy string: "Missed 2 of 5 questions. Review: Question 1 | Question 2"
  let questionsToAnalyze: string[] = [];

  if (raw.includes("Review:")) {
    const reviewPart = raw.split("Review:")[1]?.trim() || "";
    questionsToAnalyze = reviewPart
      .split("|")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
  } else {
    // If just questions or raw string
    questionsToAnalyze = [raw];
  }

  if (questionsToAnalyze.length === 0) return [];

  const missedInputs: IncorrectAnswerInput[] = questionsToAnalyze.map((prompt) => ({
    prompt,
    sourcePages: topic.sourcePageNumbers,
  }));

  return identifyConceptualGaps(missedInputs, {
    name: topic.name,
    keyConcepts: topic.keyConcepts,
    subtopics: topic.subtopics,
    definitions: topic.definitions,
    evidenceText: topic.evidenceText,
    sourcePageNumbers: topic.sourcePageNumbers,
  });
}
