import { Component } from '@theme/component';

/**
 * The coffee recommendation quiz.
 *
 * Questions and matches come from the section's blocks, serialised into the JSON script tag this
 * element wraps, so the whole quiz is edited in the theme editor.
 *
 * Scoring is a tally: every answered option adds one to its tag, and the match whose tag scores
 * highest wins. Options with no tag are deliberately inert - "I'm not sure" should not push the
 * result one way or the other. With nothing scored, the first match block is the fallback.
 *
 * @typedef {object} Refs
 * @property {HTMLScriptElement} data - The serialised questions and matches.
 * @property {HTMLElement} body - Where each step is rendered.
 * @property {HTMLElement} footer - Holds the next button.
 * @property {HTMLButtonElement} nextButton - Advances a step.
 * @property {HTMLElement} nextLabel - The next button's wording.
 * @property {HTMLElement} bag - The bag mark, cloned by the loader.
 * @property {HTMLTemplateElement} questionTemplate - One question.
 * @property {HTMLTemplateElement} revealTemplate - The loading step.
 * @property {HTMLTemplateElement} resultTemplate - The recommendation.
 *
 * @extends Component<Refs>
 */
export class CoffeeQuiz extends Component {
  requiredRefs = ['data', 'body', 'nextButton', 'nextLabel'];

  /** @type {{labels: Record<string, string>, revealMs: number, questions: any[], matches: any[]}} */
  #quiz = { labels: {}, revealMs: 3000, questions: [], matches: [] };

  #step = 0;
  /** @type {{label: string, tag: string} | null} */
  #selected = null;
  /** @type {Record<string, number>} */
  #tally = {};
  /** @type {number | undefined} */
  #revealTimer;

  connectedCallback() {
    super.connectedCallback();

    try {
      this.#quiz = JSON.parse(this.refs.data.textContent ?? '{}');
    } catch (error) {
      console.warn('[coffee-quiz] Could not read the quiz data:', error);
      return;
    }

    // Delegated, so a trigger rendered after this - a section re-render in the theme editor, or a
    // button in a section further down the page - still opens the quiz.
    document.addEventListener('click', this.#handleTriggerClick);
    document.addEventListener('keydown', this.#handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener('click', this.#handleTriggerClick);
    document.removeEventListener('keydown', this.#handleKeyDown);
    clearTimeout(this.#revealTimer);
  }

  /** @param {MouseEvent} event */
  #handleTriggerClick = (event) => {
    if (!(event.target instanceof Element)) return;

    const trigger = event.target.closest(`a[href$="#${this.id}"]`);

    if (!trigger) return;

    event.preventDefault();
    this.open();
  };

  /** @param {KeyboardEvent} event */
  #handleKeyDown = (event) => {
    if (event.key !== 'Escape' || this.hidden) return;

    this.close();
  };

  /** Opens the quiz at the first question. */
  open() {
    if (!this.#quiz.questions.length) return;

    this.#step = 0;
    this.#selected = null;
    this.#tally = {};

    this.hidden = false;
    document.body.style.overflow = 'hidden';

    this.#render();
    this.refs.closeButton?.focus();
  }

  /** Closes the quiz. */
  close = () => {
    clearTimeout(this.#revealTimer);

    this.hidden = true;
    document.body.style.overflow = '';
  };

  /** Banks the answer and moves on. */
  next() {
    const tag = this.#selected?.tag;

    if (tag) this.#tally[tag] = (this.#tally[tag] ?? 0) + 1;

    this.#step += 1;
    this.#selected = null;
    this.#render();
  }

  #render() {
    const { questions } = this.#quiz;

    if (this.#step < questions.length) this.#renderQuestion(questions[this.#step]);
    else if (this.#step === questions.length) this.#renderReveal();
    else this.#renderResult();
  }

  /** @param {{heading: string, subtext: string, options: {label: string, tag: string}[]}} question */
  #renderQuestion(question) {
    const { body, nextButton, nextLabel, footer } = this.refs;
    const { labels, questions } = this.#quiz;
    const isLast = this.#step === questions.length - 1;

    if (footer) footer.hidden = false;
    nextButton.disabled = true;
    nextLabel.textContent = isLast ? labels.last : labels.next;

    const step = this.#fill('questionTemplate');

    if (!step) return;

    const stepLabel = step.querySelector('[data-step-label]');

    if (stepLabel) {
      stepLabel.textContent = (labels.step ?? '')
        .replace('[current]', String(this.#step + 1))
        .replace('[total]', String(questions.length));
    }

    // The heading is authored as inline rich text, so it carries the design's partial italics.
    const heading = step.querySelector('[data-heading]');
    if (heading) heading.innerHTML = question.heading ?? '';

    const subtext = step.querySelector('[data-subtext]');
    if (subtext) subtext.textContent = question.subtext ?? '';

    const options = step.querySelector('[data-options]');

    for (const [index, option] of (question.options ?? []).entries()) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'coffee-quiz__option';
      button.textContent = option.label;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => this.#select(option, button, index));

      options?.appendChild(button);
    }

    body.replaceChildren(step);
  }

  /**
   * @param {{label: string, tag: string}} option
   * @param {HTMLButtonElement} button
   */
  #select(option, button) {
    for (const other of this.refs.body.querySelectorAll('.coffee-quiz__option')) {
      other.setAttribute('aria-pressed', 'false');
    }

    button.setAttribute('aria-pressed', 'true');
    this.#selected = option;
    this.refs.nextButton.disabled = false;
  }

  #renderReveal() {
    const { body, footer, bag } = this.refs;

    if (footer) footer.hidden = true;

    const reveal = this.#fill('revealTemplate');

    if (!reveal) return;

    const bags = reveal.querySelector('[data-bags]');

    // One bag per question, so the row is as long as the quiz the merchant built.
    for (let index = 0; index < this.#quiz.questions.length; index += 1) {
      const copy = bag?.cloneNode(true);

      if (!(copy instanceof HTMLElement)) continue;

      copy.style.setProperty('--coffee-quiz-bag-delay', `${index * 0.12}s`);
      bags?.appendChild(copy);
    }

    body.replaceChildren(reveal);

    this.#revealTimer = setTimeout(() => {
      this.#step += 1;
      this.#render();
    }, this.#quiz.revealMs);
  }

  #renderResult() {
    const { body, footer } = this.refs;
    const { labels } = this.#quiz;
    const match = this.#pickMatch();

    if (footer) footer.hidden = true;

    const result = this.#fill('resultTemplate');

    if (!result || !match) return;

    const image = result.querySelector('[data-image]');

    if (image instanceof HTMLImageElement) {
      if (match.image) {
        image.src = match.image;
        image.alt = match.title ?? '';
      } else {
        image.remove();
      }
    }

    const description = result.querySelector('[data-description]');
    if (description) description.textContent = match.description ?? '';

    const reasons = result.querySelector('[data-reasons]');

    for (const reason of match.reasons ?? []) {
      const item = document.createElement('li');

      item.textContent = reason;
      reasons?.appendChild(item);
    }

    const variantInput = result.querySelector('[data-variant-id]');
    const addButton = result.querySelector('[data-add-button]');

    if (variantInput instanceof HTMLInputElement) variantInput.value = String(match.variantId ?? '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.textContent = labels.addToCart ?? '';
      // A match with no product picked, or one that is sold out, has nothing to add.
      addButton.disabled = !match.variantId || !match.available;
    }

    const subscribe = result.querySelector('[data-subscribe]');

    if (subscribe instanceof HTMLAnchorElement) {
      // Subscription options live on the product page, so this hands over rather than trying to
      // reproduce the selling plan picker inside the modal.
      if (match.url) {
        subscribe.href = match.url;
        subscribe.textContent = labels.subscribe ?? '';
      } else {
        subscribe.remove();
      }
    }

    body.replaceChildren(result);
  }

  /** @returns {any} The highest scoring match, or the first one. */
  #pickMatch() {
    const { matches } = this.#quiz;

    if (!matches.length) return null;

    let winner = matches[0];
    let best = 0;

    for (const match of matches) {
      const score = this.#tally[match.tag] ?? 0;

      if (score > best) {
        best = score;
        winner = match;
      }
    }

    return winner;
  }

  /**
   * @param {'questionTemplate' | 'revealTemplate' | 'resultTemplate'} name
   * @returns {HTMLElement | null}
   */
  #fill(name) {
    const template = this.refs[name];

    if (!(template instanceof HTMLTemplateElement)) return null;

    const clone = template.content.cloneNode(true);
    const root = clone instanceof DocumentFragment ? clone.firstElementChild : null;

    return root instanceof HTMLElement ? root : null;
  }
}

if (!customElements.get('coffee-quiz')) {
  customElements.define('coffee-quiz', CoffeeQuiz);
}
