// First-run sample content: a Payments rabbit hole (Stripe → card payments → PCI DSS → 3D Secure)
// and a Telos tree seeded from an idea. All texts were written for this sample; they are summaries, not quotations.
import type { Anchor, Block, Doc, Topic, Tree, TreeNode } from "./types";
import { bodyBlocks } from "../lib/content";

const T0 = Date.UTC(2026, 10, 1, 9, 0);
const min = 60_000;

function doc(id: string, title: string, meta: Partial<Doc>, spec: [kind: "h" | "p", page: number, text: string][]): Doc {
  const blocks: Block[] = spec.map(([kind, page, text], i) => ({ id: `${id}-b${i + 1}`, kind, page, text }));
  return { id, title, type: "article", format: "web", pages: Math.max(...blocks.map((b) => b.page)), blocks, addedAt: T0, ...meta };
}

export const sampleDocs: Doc[] = [
  doc("d-stripe", "How Stripe Moves Money", { type: "web", format: "web", site: "Sample article", authors: "Reading Desk sample" }, [
    ["p", 1, "When you pay for something online, the shop rarely handles your card itself. Companies like Stripe sit between the shop and the banks, so a developer can accept card payments with a few lines of code instead of building connections to the card networks."],
    ["p", 1, "Stripe gives the shop a checkout form whose card fields are hosted by Stripe. The card number is sent straight to Stripe and replaced with a token, a stand-in value the shop can store and charge later without ever holding the real number."],
    ["h", 2, "What happens when you press Pay"],
    ["p", 2, "Behind the button, the payment travels through the card networks such as Visa and Mastercard to the bank that issued the card, which approves or declines it in about a second. Days later the money is cleared and settled into the shop's account, minus fees."],
    ["p", 2, "Keeping card data away from the shop's own servers matters because anyone who stores, processes or transmits card numbers must meet the PCI DSS security standard. Hosted fields shrink how much of that standard the shop has to prove."],
    ["p", 2, "In Europe and the UK, many online card payments also need strong customer authentication. Stripe handles this with 3D Secure, which can ask the cardholder to confirm the payment in their banking app."],
    ["h", 3, "Why it matters"],
    ["p", 3, "The result is that a two-person company can take payments from customers in dozens of countries on its first day, while the hardest parts, security, compliance and fraud checks, are handled by specialists."],
  ]),
  doc("d-primer", "How Card Payments Work", { type: "article", format: "pdf", authors: "Reading Desk sample primer" }, [
    ["h", 1, "The parties"],
    ["p", 1, "Every card payment involves five parties: the cardholder, the merchant, the acquirer (the merchant's bank or payment processor), the card network, and the issuer (the cardholder's bank)."],
    ["h", 2, "Authorisation"],
    ["p", 2, "When the card is used, the acquirer sends an authorisation request through the network to the issuer. The issuer checks the available balance and fraud signals and replies with an approval or a decline."],
    ["h", 3, "Clearing and settlement"],
    ["p", 3, "Approved transactions are batched and sent for clearing, where the parties exchange the details needed to post them. In settlement, the issuer pays the acquirer, and the acquirer pays the merchant."],
    ["p", 3, "Along the way the issuer keeps an interchange fee, paid by the acquirer and usually passed on to the merchant. In the UK and EU, interchange on consumer cards is capped at 0.2% for debit and 0.3% for credit."],
    ["h", 4, "Keeping card data safe"],
    ["p", 4, "Because card numbers pass between so many parties, the industry agreed a common security standard, PCI DSS, and later added cardholder authentication through 3D Secure."],
  ]),
  doc("d-pci", "PCI DSS in Brief", { type: "article", format: "pdf", authors: "Reading Desk sample" }, [
    ["h", 1, "What PCI DSS is"],
    ["p", 1, "The Payment Card Industry Data Security Standard is a set of security requirements for any organisation that stores, processes or transmits cardholder data. It is maintained by the PCI Security Standards Council, founded by the major card brands."],
    ["p", 1, "The current version, 4.0, groups its controls under twelve requirements, from network security and encryption to access control, monitoring and regular testing."],
    ["h", 2, "Scope"],
    ["p", 2, "The most effective way to reduce the work is to reduce scope: if card data never touches your systems, far fewer requirements apply. Merchants using fully hosted payment pages can often complete the shortest self-assessment questionnaire, SAQ A."],
    ["h", 3, "Authentication is a separate problem"],
    ["p", 3, "PCI DSS protects card data once it is in the system. It does not prove that the person paying is the cardholder. That job falls to authentication schemes such as 3D Secure."],
  ]),
  doc("d-3ds", "3D Secure Explained", { type: "web", format: "web", site: "Sample article", authors: "Reading Desk sample" }, [
    ["h", 1, "What 3D Secure does"],
    ["p", 1, "3D Secure adds a step in which the card issuer checks that the person paying really is the cardholder. The name refers to the three domains involved: the issuer, the acquirer, and the interoperability domain that connects them."],
    ["p", 1, "The current version, 3D Secure 2, sends the issuer far more data about the transaction and device. In most cases the issuer can approve silently, the frictionless flow; only riskier payments trigger a challenge, such as a one-time code or approval in a banking app."],
    ["h", 2, "Why merchants use it"],
    ["p", 2, "When a payment is authenticated with 3D Secure, liability for most fraud chargebacks shifts from the merchant to the issuer. In the UK and EEA it is also the main way to meet the strong customer authentication rules."],
  ]),
];

const docById = Object.fromEntries(sampleDocs.map((d) => [d.id, d]));

function at(nodeId: string, blocks: Block[], blockId: string, phrase: string): Anchor {
  const b = blocks.find((x) => x.id === blockId);
  if (!b) throw new Error(`Sample block not found: ${blockId}`);
  const start = b.text.indexOf(phrase);
  if (start < 0) throw new Error(`Sample phrase not found: ${phrase}`);
  return { docId: nodeId, blockId, start, end: start + phrase.length, quote: phrase, page: b.page };
}
const inDoc = (nodeId: string, docId: string, blockN: number, phrase: string) => at(nodeId, docById[docId].blocks, `${docId}-b${blockN}`, phrase);

const TELOS_BODY = "Telos came up in *Fooled by Randomness*. I want to understand what it means, where it comes from, and whether it's a useful way to think about my own work.\n\nFirst impression: it means an end or purpose, the thing something is for.";
const telosBlocks = bodyBlocks("n-telos", TELOS_BODY);

const base = { anchors: [] as Anchor[] };
export const sampleNodes: TreeNode[] = [
  // Payments
  { ...base, id: "n-stripe", treeId: "tr-payments", kind: "source", title: "How Stripe Moves Money", parentId: null, docId: "d-stripe", createdAt: T0 },
  { id: "n-primer", treeId: "tr-payments", kind: "source", title: "How Card Payments Work", parentId: "n-stripe", docId: "d-primer", anchors: [inDoc("n-stripe", "d-stripe", 4, "card networks such as Visa and Mastercard")], createdAt: T0 + 3 * min },
  { id: "n-token", treeId: "tr-payments", kind: "note", title: "Tokens", parentId: "n-stripe", anchors: [inDoc("n-stripe", "d-stripe", 2, "replaced with a token")], body: "Tokenisation is why the shop never sees the real number. Check: can a token from one shop be charged by another?", createdAt: T0 + 2 * min },
  { id: "n-scope-q", treeId: "tr-payments", kind: "note", title: "Hosted fields and PCI", parentId: "n-stripe", anchors: [inDoc("n-stripe", "d-stripe", 5, "Hosted fields shrink how much of that standard the shop has to prove.")], body: "How much smaller? Find out what the shop still has to do.", createdAt: T0 + 4 * min },
  { id: "n-interchange", treeId: "tr-payments", kind: "definition", title: "Interchange fee", parentId: "n-primer", anchors: [inDoc("n-primer", "d-primer", 7, "interchange fee")], body: "A fee the card issuer receives on each card payment. It is paid by the acquirer and usually passed on to the merchant inside the processing fee.", createdAt: T0 + 6 * min },
  { id: "n-cap", treeId: "tr-payments", kind: "note", title: "Interchange caps", parentId: "n-primer", anchors: [inDoc("n-primer", "d-primer", 7, "capped at 0.2% for debit and 0.3% for credit")], body: "So most of a UK merchant's card cost is the processor's margin, not interchange. Compare this with Stripe's pricing.", createdAt: T0 + 7 * min },
  { id: "n-pci", treeId: "tr-payments", kind: "source", title: "PCI DSS in Brief", parentId: "n-primer", docId: "d-pci", anchors: [inDoc("n-primer", "d-primer", 9, "a common security standard, PCI DSS")], createdAt: T0 + 9 * min },
  { id: "n-scope", treeId: "tr-payments", kind: "note", title: "Scope is the lever", parentId: "n-pci", anchors: [inDoc("n-pci", "d-pci", 5, "if card data never touches your systems, far fewer requirements apply")], body: "This answers my question from the Stripe article: hosted fields keep card data off the shop's servers, so the shop can use SAQ A.", createdAt: T0 + 11 * min },
  { id: "n-3ds", treeId: "tr-payments", kind: "source", title: "3D Secure Explained", parentId: "n-pci", docId: "d-3ds", anchors: [inDoc("n-pci", "d-pci", 7, "authentication schemes such as 3D Secure")], createdAt: T0 + 13 * min },
  { id: "n-frictionless", treeId: "tr-payments", kind: "explanation", title: "The frictionless flow", parentId: "n-3ds", depth: "educational", anchors: [inDoc("n-3ds", "d-3ds", 3, "the frictionless flow")], body: "The issuer looks at the data sent with the payment, such as the device, the amount and the customer's history, and decides the risk is low enough to approve without asking anything. The shopper sees nothing extra. Only when something looks unusual does the issuer step in with a challenge.", createdAt: T0 + 15 * min },
  { id: "n-chargeback", treeId: "tr-payments", kind: "clipping", title: "Chargeback", parentId: "n-3ds", anchors: [inDoc("n-3ds", "d-3ds", 5, "liability for most fraud chargebacks shifts from the merchant to the issuer")], clip: { text: "A chargeback is when a cardholder disputes a payment and their bank reverses it, taking the money back from the merchant.", source: { url: "https://en.wikipedia.org/wiki/Chargeback", site: "Wikipedia", title: "Chargeback" } }, body: "So 3D Secure moves the cost of fraud disputes onto the issuer.", createdAt: T0 + 16 * min },

  // Telos
  { ...base, id: "n-telos", treeId: "tr-telos", kind: "note", title: "Telos", parentId: null, body: TELOS_BODY, createdAt: T0 + 60 * min },
  { id: "n-telos-def", treeId: "tr-telos", kind: "definition", title: "Telos", parentId: "n-telos", anchors: [at("n-telos", telosBlocks, "n-telos-p2", "an end or purpose")], body: "From the Greek for \"end\" or \"goal\": the purpose or final aim of something. In Aristotle, a thing's telos is what it is for, as the telos of an acorn is to become an oak.", defSource: { url: "https://en.wikipedia.org/wiki/Telos", site: "Wikipedia", title: "Telos" }, createdAt: T0 + 62 * min },
  { id: "n-telos-q", treeId: "tr-telos", kind: "note", title: "A career's telos?", parentId: "n-telos", anchors: [at("n-telos", telosBlocks, "n-telos-p1", "a useful way to think about my own work")], body: "Question to come back to: does a career have a telos, or is it a series of experiments?", createdAt: T0 + 63 * min },
];

export const sampleTopics: Topic[] = [
  { id: "t-finance", name: "Finance", parentIds: [], createdAt: T0 },
  { id: "t-payments", name: "Payments", parentIds: ["t-finance"], createdAt: T0 },
  { id: "t-security", name: "Security", parentIds: ["t-cs"], createdAt: T0 },
  { id: "t-cardsec", name: "Card security", parentIds: ["t-payments", "t-security"], createdAt: T0 },
  { id: "t-philosophy", name: "Philosophy", parentIds: [], createdAt: T0 },
  { id: "t-cs", name: "Computer Science", parentIds: [], createdAt: T0 },
  { id: "t-logic", name: "Logic", parentIds: ["t-philosophy", "t-cs"], createdAt: T0 },
  { id: "t-syllogistic", name: "Syllogistic method", parentIds: ["t-logic"], createdAt: T0 },
  { id: "t-teleology", name: "Teleology", parentIds: ["t-philosophy"], createdAt: T0 },
];

export const sampleTrees: Tree[] = [
  {
    id: "tr-payments", title: "Payments", seedId: "n-stripe", topicIds: ["t-payments", "t-cardsec"],
    understanding: "A card payment passes through five parties: cardholder, merchant, acquirer, network and issuer. Authorisation happens in about a second; clearing and settlement take days.\n\nStripe's value is hiding all of this. Its hosted card fields keep card numbers off the shop's servers, which shrinks PCI DSS scope, and it runs 3D Secure where strong customer authentication is required.\n\nStill to understand: how Stripe prices on top of interchange.",
    trails: [{ id: "trail-1", nodeIds: ["n-stripe", "n-primer", "n-pci", "n-3ds"], openedAt: T0 + 16 * min }],
    createdAt: T0, updatedAt: T0 + 16 * min, lastOpenedAt: T0 + 16 * min,
  },
  {
    id: "tr-telos", title: "Telos", seedId: "n-telos", topicIds: ["t-teleology"], understanding: "", trails: [],
    createdAt: T0 + 60 * min, updatedAt: T0 + 63 * min, lastOpenedAt: T0 + 63 * min,
  },
];
