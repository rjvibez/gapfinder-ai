import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  selectContextChunks,
  resolveQuestionCitation,
  normalizePageNumbers,
  scoreEvidenceMatch,
  rankEvidenceMatches,
  matchSupportingTextToChunks,
} from "../src/lib/quizCitations.ts";

describe("General-Purpose RAG Citation-Matching Algorithm Tests", () => {
  // Generic multi-subject, multi-page test corpus
  const genericCorpus = [
    {
      chunk_index: 0,
      page_number: 1,
      content:
        "Computer Networking Overview: The OSI model defines seven layers of communication protocols from physical to application layer.",
    },
    {
      chunk_index: 1,
      page_number: 1,
      content:
        "Data structures introduction: A tree is a non-linear hierarchical data structure consisting of nodes and directed edges.",
    },
    {
      chunk_index: 2,
      page_number: 2,
      content:
        "Binary search trees: In a binary search tree, the left subtree contains values strictly less than the root node.",
    },
    {
      chunk_index: 3,
      page_number: 2,
      content:
        "Classical Mechanics: According to Newton's second law of motion, the acceleration of an object is directly proportional to the net force",
    },
    {
      chunk_index: 4,
      page_number: 2,
      content:
        "force applied to it and inversely proportional to its mass, expressed by the formula F = ma.",
    },
    {
      chunk_index: 5,
      page_number: 3,
      content:
        "World History: Habeas corpus is a recourse in law through which a person can report an unlawful detention or imprisonment.",
    },
    {
      chunk_index: 6,
      page_number: 3,
      content:
        "Macroeconomics: Fiscal policy involves government spending and taxation to influence economic activity, whereas monetary policy,",
    },
    {
      chunk_index: 7,
      page_number: 4,
      content:
        "monetary policy is managed by the central bank to control money supply and stabilize benchmark interest rates.",
    },
    {
      chunk_index: 8,
      page_number: 4,
      content:
        "Transport Layer Protocols: The TCP three-way handshake establishes a reliable connection using SYN, SYN-ACK, and ACK packets.",
    },
    {
      chunk_index: 9,
      page_number: 5,
      content:
        "Advanced Balanced Trees: A red-black tree is a self-balancing binary search tree where each node stores an extra color bit.",
    },
  ];

  it("1. Incorrect model page suggestion versus correct evidence page", () => {
    // Model erroneously suggested Page 1, but evidence text is exclusively on Page 4
    const question = {
      prompt: "Which packets are exchanged during the TCP connection setup?",
      options: [
        "SYN, SYN-ACK, and ACK packets",
        "RST, FIN, and PSH packets",
        "UDP datagrams with checksum",
        "ICMP echo request and reply",
      ],
      correctIndex: 0,
      explanation: "TCP uses a three-way handshake involving SYN, SYN-ACK, and ACK.",
      sourcePages: [1], // Model hallucination / default to page 1
      supportingText:
        "The TCP three-way handshake establishes a reliable connection using SYN, SYN-ACK, and ACK packets.",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    // Ground truth is Page 4; model suggestion [1] must be completely discarded
    assert.deepEqual(result.sourcePages, [4]);
    assert.equal(
      result.supportingText,
      "The TCP three-way handshake establishes a reliable connection using SYN, SYN-ACK, and ACK packets."
    );
  });

  it("2. Identical or similar terminology appearing on multiple pages", () => {
    // "tree", "binary search", and "nodes" appear on Page 1, Page 2, and Page 5
    // The specific statement is exclusively on Page 5
    const question = {
      prompt: "What additional attribute is stored in each node of a red-black tree?",
      options: ["An extra color bit", "Height integer", "Parent pointer", "Balance factor"],
      correctIndex: 0,
      explanation: "Red-black trees store an extra bit indicating node color.",
      sourcePages: [1], // Model erroneously suggested page 1 due to keyword "tree"
      supportingText:
        "A red-black tree is a self-balancing binary search tree where each node stores an extra color bit.",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    // Page 5 must win; incidental mentions on Page 1 & 2 must be rejected
    assert.deepEqual(result.sourcePages, [5]);
  });

  it("3. Supporting evidence split across chunks on the same page", () => {
    // Chunk 3 ends with "...net force" and Chunk 4 starts with "force applied to it..."
    // Neither chunk individually contains the entire quote
    const question = {
      prompt: "How does Newton's second law describe acceleration?",
      options: [
        "Directly proportional to net force and inversely proportional to mass",
        "Directly proportional to velocity squared",
        "Independent of applied net force",
        "Inversely proportional to net acceleration",
      ],
      correctIndex: 0,
      explanation: "F = ma relates force, mass, and acceleration.",
      sourcePages: [2],
      supportingText:
        "acceleration of an object is directly proportional to the net force applied to it and inversely proportional to its mass",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    assert.deepEqual(result.sourcePages, [2]);
    assert.ok(result.supportingText);
  });

  it("4. Evidence spanning multiple pages across chunk boundary", () => {
    // Chunk 6 is on Page 3 and Chunk 7 is on Page 4
    const question = {
      prompt: "How are fiscal and monetary policy distinguished?",
      options: [
        "Fiscal policy uses government spending, monetary policy is managed by the central bank",
        "Both are managed by judicial courts",
        "Fiscal policy sets interest rates while monetary policy taxes imports",
        "Monetary policy regulates criminal statutes",
      ],
      correctIndex: 0,
      explanation: "Fiscal policy is government-led; monetary policy is central bank-led.",
      supportingText:
        "Fiscal policy involves government spending and taxation to influence economic activity, whereas monetary policy is managed by the central bank to control money supply",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    // Must identify both Page 3 and Page 4
    assert.deepEqual(result.sourcePages, [3, 4]);
  });

  it("5. Exact match versus partial keyword overlap", () => {
    // Document mentions general terms across pages, but exact legal principle is on Page 3
    const question = {
      prompt: "What legal recourse protects individuals against unlawful detention?",
      options: ["Habeas corpus", "Subpoena duces tecum", "Quo warranto", "Certiorari"],
      correctIndex: 0,
      explanation: "Habeas corpus addresses unlawful imprisonment.",
      sourcePages: [1],
      supportingText:
        "Habeas corpus is a recourse in law through which a person can report an unlawful detention or imprisonment.",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    assert.deepEqual(result.sourcePages, [3]);
  });

  it("6. Evidence absent from the uploaded document", () => {
    // Hallucinated quote absent from any chunk in the document
    const question = {
      prompt: "How does quantum entanglement allow faster-than-light communication?",
      options: [
        "Through nonlocal state collapse",
        "Through wormhole bridging",
        "Through tachyon emission",
        "It does not allow faster-than-light communication",
      ],
      correctIndex: 3,
      explanation: "Quantum entanglement does not transmit classical information faster than light.",
      sourcePages: [1, 2],
      supportingText:
        "Quantum entanglement enables instantaneous faster-than-light communication across arbitrary distances without signal attenuation.",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    // Must return empty array and undefined text; never invent a citation
    assert.deepEqual(result.sourcePages, []);
    assert.equal(result.supportingText, undefined);
  });

  it("7. Cross-user and cross-material isolation", () => {
    const userA_Material1 = [
      { chunk_index: 0, page_number: 1, content: "Algebraic equations and linear transformations." },
      { chunk_index: 1, page_number: 2, content: "Matrix eigenvalues and characteristic polynomials." },
    ];

    // External question references Page 99 from another user's material
    const crossQuestion = {
      prompt: "What is an eigenvalue?",
      sourcePages: [99], // Page 99 belongs to another material/user
      supportingText: "Matrix eigenvalues and characteristic polynomials.",
    };

    const result = resolveQuestionCitation(crossQuestion, userA_Material1);

    // Citations are strictly restricted to userA_Material1's pages (Page 2)
    assert.deepEqual(result.sourcePages, [2]);
    assert.ok(!result.sourcePages.includes(99), "Page 99 from external material must be rejected");
  });

  it("8. Quantitative scoring tiers prioritize exact and normalized over incidental matches", () => {
    const content = "The speed of light in vacuum is approximately 299792458 meters per second.";

    // Exact match
    const exactScore = scoreEvidenceMatch(
      "speed of light in vacuum is approximately 299792458 meters per second",
      content
    );
    assert.ok(exactScore >= 1000, "Exact match score must be >= 1000");

    // Normalized match (punctuation/symbols)
    const normScore = scoreEvidenceMatch(
      "“Speed of light in vacuum is approximately: 299,792,458 meters per second!”",
      content
    );
    assert.ok(normScore >= 800, `Normalized match score (${normScore}) must be >= 800`);

    // Incidental keyword overlap (only common words like 'of', 'in', 'is')
    const incidentalScore = scoreEvidenceMatch(
      "A car moving in a vacuum chamber of glass is parked",
      content
    );
    assert.ok(
      incidentalScore < 200,
      `Incidental score (${incidentalScore}) must be below minimum verification threshold 200`
    );

    assert.ok(exactScore > normScore, "Exact score must exceed normalized score");
    assert.ok(normScore > incidentalScore, "Normalized score must exceed incidental score");
  });

  it("9. Page numbers are safely normalized and deduplicated", () => {
    assert.deepEqual(normalizePageNumbers([1, "2", 2, "invalid", -5, 3]), [1, 2, 3]);
    assert.deepEqual(normalizePageNumbers("4"), [4]);
    assert.deepEqual(normalizePageNumbers(null), []);
    assert.deepEqual(normalizePageNumbers(undefined), []);
  });

  it("10. rankEvidenceMatches orders candidates by quantitative match strength", () => {
    const text = "binary search tree left subtree";
    const matches = rankEvidenceMatches(text, genericCorpus);
    assert.ok(matches.length > 0);
    // Highest score should be on Page 2 where the binary search tree definition resides
    assert.equal(matches[0].pages[0], 2);
    // Scores must be sorted descending
    for (let i = 0; i < matches.length - 1; i++) {
      assert.ok(matches[i].score >= matches[i + 1].score);
    }

    // Verify matchSupportingTextToChunks returns the highest-ranking supporting chunks
    const supportingChunks = matchSupportingTextToChunks(text, genericCorpus);
    assert.ok(supportingChunks.length > 0);
    assert.equal(supportingChunks[0].page_number, 2);

    // Verify selectContextChunks preserves chunks within bounds
    const context = selectContextChunks(genericCorpus, { name: "Trees", source_page_numbers: [2] });
    assert.ok(context.length > 0);
    assert.ok(context.some((c) => c.page_number === 2));
  });

  it("11. Failure A regression: Photosynthesis equation on Page 2 vs similar definition on Page 1", () => {
    const biologyCorpus = [
      {
        chunk_index: 0,
        page_number: 1,
        content:
          "Photosynthesis is the fundamental process by which green plants manufacture glucose from carbon dioxide and water using light energy absorbed by chlorophyll, releasing oxygen as a byproduct.",
      },
      {
        chunk_index: 1,
        page_number: 1,
        content:
          "Leaf structure: Lower epidermis contains stomata for gas exchange. Xylem vessels transport water and dissolved minerals from roots to leaves.",
      },
      {
        chunk_index: 2,
        page_number: 2,
        content:
          "Plant cell structures: Palisade mesophyll cells are packed with chloroplasts containing chlorophyll to maximize light capture.",
      },
      {
        chunk_index: 3,
        page_number: 2,
        content:
          "Word equation for photosynthesis: carbon dioxide + water -> glucose + oxygen. Light energy and chlorophyll are essential conditions.",
      },
    ];

    const question = {
      prompt: "What is the word equation representing photosynthesis?",
      options: [
        "carbon dioxide + water -> glucose + oxygen",
        "glucose + oxygen -> carbon dioxide + water",
        "carbon dioxide + glucose -> water + oxygen",
        "water + oxygen -> glucose + carbon dioxide",
      ],
      correctIndex: 0,
      explanation: "The word equation shows carbon dioxide and water reacting to form glucose and oxygen.",
      sourcePages: [1], // Erroneous model suggestion / default to Page 1
      supportingText:
        "Word equation: carbon dioxide + water —(light energy and chlorophyll) → glucose + oxygen",
    };

    const result = resolveQuestionCitation(question, biologyCorpus);

    // Page 2 must win over Page 1 definition despite identical chemical vocabulary
    assert.deepEqual(result.sourcePages, [2]);
    assert.ok(result.supportingText);
  });

  it("12. Failure B regression: Xylem question incorrectly paired with pondweed evidence", () => {
    const biologyCorpus = [
      {
        chunk_index: 0,
        page_number: 1,
        content:
          "Photosynthesis is the fundamental process by which green plants manufacture glucose from carbon dioxide and water.",
      },
      {
        chunk_index: 1,
        page_number: 1,
        content:
          "Leaf structure and transport: Xylem vessels transport water and dissolved mineral ions absorbed by the roots up to the leaves.",
      },
      {
        chunk_index: 2,
        page_number: 3,
        content:
          "Measuring rate: In the pondweed experiment, bubbles of oxygen gas emerge from the cut stem in water. Count the bubbles produced per minute.",
      },
    ];

    // Model paired a question about Xylem with a quote about pondweed on Page 3
    const question = {
      prompt: "Which specialized vessel transports water and dissolved mineral ions from the roots to the leaves?",
      options: ["Xylem vessels", "Phloem tubes", "Stomata pores", "Spongy mesophyll"],
      correctIndex: 0,
      explanation: "Xylem vessels transport water and dissolved minerals upwards.",
      sourcePages: [3], // Model cited Page 3 because of pondweed quote
      supportingText:
        "In the pondweed experiment, bubbles of oxygen gas emerge from the cut stem in water. Count the bubbles produced per minute.",
    };

    const result = resolveQuestionCitation(question, biologyCorpus);

    // Pondweed quotation on Page 3 does NOT support xylem; Page 3 must be REJECTED
    // Grounding verification must identify the genuine evidence on Page 1
    assert.deepEqual(result.sourcePages, [1]);
    assert.ok(!result.sourcePages.includes(3), "Page 3 (pondweed) must be rejected for xylem question");
    assert.ok(result.supportingText?.toLowerCase().includes("xylem"));
  });

  it("13. Correct evidence quotation paired with an unrelated question is rejected", () => {
    // Quote is genuine text from Page 1 (TCP handshake), but question is about mitochondria (absent from corpus)
    const question = {
      prompt: "What cellular organelle generates ATP through oxidative phosphorylation in eukaryotes?",
      options: ["Mitochondria", "Ribosome", "Golgi apparatus", "Endoplasmic reticulum"],
      correctIndex: 0,
      explanation: "Mitochondria produce cellular ATP.",
      sourcePages: [1],
      supportingText:
        "The TCP three-way handshake establishes a reliable connection using SYN, SYN-ACK, and ACK packets.",
    };

    const result = resolveQuestionCitation(question, genericCorpus);

    // Unrelated quote cannot support the question, and mitochondria is absent from the corpus
    // Must return empty array and undefined text; never falsely cite Page 1
    assert.deepEqual(result.sourcePages, []);
    assert.equal(result.supportingText, undefined);
  });

  it("14. Equation formatting differences (Unicode arrows, em-dashes, condition annotations)", () => {
    const physicsChemistryCorpus = [
      {
        chunk_index: 0,
        page_number: 2,
        content:
          "Chemical reactions:\nPhotosynthesis word equation:\ncarbon dioxide + water -> glucose + oxygen\n(under light and chlorophyll)",
      },
    ];

    const question = {
      prompt: "What is the equation for photosynthesis?",
      options: [
        "carbon dioxide + water -> glucose + oxygen",
        "glucose + oxygen -> carbon dioxide + water",
        "carbon dioxide + water -> starch",
        "glucose + water -> oxygen",
      ],
      correctIndex: 0,
      supportingText: "carbon dioxide + water —(light and chlorophyll)→ glucose + oxygen",
    };

    const result = resolveQuestionCitation(question, physicsChemistryCorpus);

    assert.deepEqual(result.sourcePages, [2]);
  });

  it("15. Multi-subject grounding validation across computer science, biology, and chemistry", () => {
    const multiSubjectCorpus = [
      {
        chunk_index: 0,
        page_number: 1,
        content:
          "Operating Systems: Virtual memory uses paging and page tables to map virtual addresses to physical frames.",
      },
      {
        chunk_index: 1,
        page_number: 3,
        content:
          "Database Systems: Two-phase locking (2PL) guarantees serializability by acquiring all locks before releasing any.",
      },
    ];

    const osQuestion = {
      prompt: "How does virtual memory translate addresses?",
      options: [
        "Using page tables to map virtual to physical frames",
        "Using two-phase locking",
        "Through round-robin scheduling",
        "Via DNS resolution",
      ],
      correctIndex: 0,
      supportingText:
        "Virtual memory uses paging and page tables to map virtual addresses to physical frames.",
    };

    const result = resolveQuestionCitation(osQuestion, multiSubjectCorpus);
    assert.deepEqual(result.sourcePages, [1]);
  });
});
