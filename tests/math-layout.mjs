import assert from "node:assert/strict";
import layout from "../math-layout.js";
import engine from "../question-engine.js";

function covered(text, formula) {
  const start = text.indexOf(formula);
  assert.ok(start >= 0, formula);
  assert.ok(layout.ranges(text).some(range => range.start <= start && range.end >= start + formula.length),
    `Formule protégée seulement en partie : ${formula}\n${JSON.stringify(layout.ranges(text).map(({start,end})=>text.slice(start,end)))}`);
}

const cases = [
  "f(x) = 2(x − 3)² − 2", "f(x) = −(x + 4)² + 5", "f(x) = x²", "f(x) = 2x² − 3x + 1",
  "f(x) = −2(x + 3)(x − 5)", "f′(x) = 3x² + 2x − 7", "f(3) = 2 × 3 + 4 = 10",
  "S(3 ; −2)", "uₙ₊₁ = 3uₙ + 2", "uₙ = 4 × 2ⁿ", "y′ = 1/(1 + t²)",
  "f(x) = sin(x)/x", "P(A∩B)/P(A) = 0,25", "norm(vec(u)) × norm(vec(v)) × cos(π/3)",
  "2(cos(π/3) + sin(π/3)i)", "[2 ; −π/3]", "3x² − 5x + 2", "5 × 10⁻³", "25 %",
  "f(x) = √(x + 1) + 2", "A = {1 ; 2 ; 3}", "Card(A ∩ B) = 2", "]−∞ ; 3]",
  "s(t) = 3 cos(ωt + φ)", "zB − zA = 3 + 2i", "AB = 5", "norm(vec(AB)) = √5"
];
for (const formula of cases) covered(`On considère ${formula} dans cet exercice.`, formula);
assert.deepEqual(layout.ranges("La parabole possède un sommet."), [], "la prose doit rester libre de revenir à la ligne");

let seed = 31795462;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
let checked = 0;
for (const kind of ["quadratic-vertex", "quadratic-roots"]) {
  for (let i = 0; i < 200; i++) {
    const question = engine.generateForKinds([kind], {}, random);
    if (kind.startsWith("quadratic-")) {
      const start = question.prompt.indexOf("f(x)");
      const end = question.prompt.indexOf(" ?", start);
      covered(question.prompt, question.prompt.slice(start, end));
      if (kind === "quadratic-vertex") {
        for (const choice of question.choices) covered(choice, choice);
        const expression = question.explanation.match(/^La forme canonique (.+?) donne directement/)[1];
        covered(question.explanation, expression);
      }
      checked++;
    }
  }
}
console.log(`${cases.length} expressions témoins et ${checked} paraboles générées entièrement protégées.`);
