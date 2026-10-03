(function (root, factory) {
  const layout = factory();
  if (typeof module === "object" && module.exports) module.exports = layout;
  else root.NexusMathLayout = layout;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LETTER = /[A-Za-zÀ-ÿ_]/;
  const SCRIPT = /[₀₁₂₃₄₅₆₇₈₉₊₋ₙ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ²³′]/;
  const SPACE = /[\s\u2060]/;
  const FUNCTIONS = /^(?:norm|vec|sin|cos|tan|Card|[fgP]|[A-Z])′?(?=\()/;

  function skipSpace(text, index) {
    while (index < text.length && SPACE.test(text[index])) index += 1;
    return index;
  }

  // Read complete expressions, including balanced factors and chained equalities.
  // Prose stops the expression; whitespace alone never truncates a polynomial.
  function expressionEnd(text, start, depth = 0) {
    if (depth > 16) return start;
    function atomEnd(index) {
      const initial = index;
      index = skipSpace(text, index);
      if (/[+−-]/.test(text[index] || "")) index = skipSpace(text, index + 1);
      while (text[index] === "√") index = skipSpace(text, index + 1);
      const opening = text[index];
      const functionName = text.slice(index).match(FUNCTIONS)?.[0];
      if (functionName || ["(", "[", "]", "{"].includes(opening)) {
        const bracketAt = index + (functionName?.length || 0);
        const closings = { "(": [")"], "[": ["]", "["], "]": ["[", "]"], "{": ["}"] }[text[bracketAt]];
        let end = expressionEnd(text, bracketAt + 1, depth + 1);
        if (end === bracketAt + 1) return initial;
        let next = skipSpace(text, end);
        while (text[next] === ";" || text[next] === ",") {
          end = expressionEnd(text, next + 1, depth + 1);
          if (end === next + 1) return initial;
          next = skipSpace(text, end);
        }
        if (!closings.includes(text[next])) return initial;
        index = next + 1;
      } else {
        const number = text.slice(index).match(/^\d+(?:[,.]\d+)?/)?.[0];
        if (number) index += number.length;
        else if (/[A-Za-zαβγδλμσωρπθφℝℕℤ∅∞]/.test(text[index] || "")) {
          const label = text.slice(index).match(/^(?:z[A-Z]|[A-Z]{1,3})(?![A-Za-zÀ-ÿ_])/)?.[0];
          index += label?.length || 1;
          if (/[A-Za-z]/.test(text[index - 1]) && LETTER.test(text[index] || "")) return initial;
          if (/[A-Z]/.test(text[index - 1])) {
            const cellRow = text.slice(index).match(/^\d+/)?.[0];
            if (cellRow) index += cellRow.length;
          }
        } else return initial;
      }
      while (index < text.length && SCRIPT.test(text[index])) index += 1;
      return index;
    }

    let end = atomEnd(start);
    if (end === start) return start;
    while (end < text.length) {
      const next = skipSpace(text, end);
      const operator = text.slice(next).match(/^(?:<=|>=|!=|[+−×÷*/·=<>≤≥≈≠∩∪∈∉^-])/u)?.[0];
      if (operator) {
        const operandStart = skipSpace(text, next + operator.length);
        const operandEnd = atomEnd(operandStart);
        if (operandEnd === operandStart) break;
        end = operandEnd;
      } else {
        // Implicit products: 2x, 2(x − 3)², sin(ωt), sin(t)i.
        if (next !== end && text[next] !== "(" && !FUNCTIONS.test(text.slice(next))) break;
        const operandEnd = atomEnd(next);
        if (operandEnd === next) break;
        end = operandEnd;
      }
    }
    return end;
  }

  function ranges(text, fallbackPattern) {
    const found = [];
    for (let start = 0; start < text.length;) {
      if (SPACE.test(text[start])) {
        start += 1;
        continue;
      }
      if (start > 0 && (LETTER.test(text[start - 1]) || /\d/.test(text[start - 1]))) {
        start += 1;
        continue;
      }
      const end = expressionEnd(text, start);
      if (end > start) {
        const unit = text.slice(end).match(/^\s*(?:%|°|€|km|cm|mm|kg|min|m|s|h|g)(?![A-Za-zÀ-ÿ])/u)?.[0];
        found.push({ start, end: end + (unit?.length || 0) });
        start = found.at(-1).end;
      } else start += 1;
    }
    // Keep specialised notations already supported by the renderer.
    if (fallbackPattern) {
      for (const match of text.matchAll(fallbackPattern)) {
        found.push({ start: match.index, end: match.index + match[0].length });
      }
    }
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const range of found) {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
    }
    return merged;
  }

  function fit(target) {
    if (!target.isConnected) {
      observer?.unobserve(target);
      observed.delete(target);
      return;
    }
    if (!target.clientWidth) return;
    const style = getComputedStyle(target);
    const available = target.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (available <= 0) return;
    for (const formula of target.querySelectorAll(".math-inline")) {
      formula.style.fontSize = "";
      const width = formula.getBoundingClientRect().width;
      // A closing full stop or question mark stays attached to the formula.
      // Reserve its width too, otherwise it can push the line beyond the card.
      const next = formula.nextSibling;
      const punctuation = next?.nodeType === 3 ? next.textContent.match(/^[\s\u00a0]*[.,;:!?]+/)?.[0] : null;
      let suffixWidth = 0;
      if (punctuation) {
        const suffix = document.createRange();
        suffix.setStart(next, 0);
        suffix.setEnd(next, punctuation.length);
        suffixWidth = [...suffix.getClientRects()].reduce((sum, rect) => sum + rect.width, 0);
      }
      const allowed = Math.max(1, available - suffixWidth - 1);
      if (width > allowed) {
        const size = parseFloat(getComputedStyle(formula).fontSize);
        formula.style.fontSize = `${size * allowed / width * 0.98}px`;
      }
    }
  }

  const observed = new WeakSet();
  const observer = typeof ResizeObserver === "function"
    ? new ResizeObserver(entries => entries.forEach(({ target }) => requestAnimationFrame(() => fit(target))))
    : null;
  function fitWhenReady(target) {
    if (!observed.has(target)) {
      observed.add(target);
      observer?.observe(target);
    }
    requestAnimationFrame(() => fit(target));
  }

  return { ranges, fitWhenReady };
});
