const {readFileSync, readdirSync, statSync} = require('fs');
const {basename, join} = require('path');

const {jsdom} = require('jsdom/lib/old-api');

const {dom, props, out, rule, ruleset, score, type} = require('fathom-web');


/**
 * Parse an HTML doc, and return a DOM-compliant interface to it. Do not
 * execute any of its inline scripts.
 */
function staticDom(html) {
    return jsdom(html, {features: {ProcessExternalResources: false,
                                   FetchExternalResources: false}});
}

function comicRuleset(boundingRect, coeffSize = 1) {
    function isBannerSize(element) {
        const rect = boundingRect(element);
        const height = rect.bottom - rect.top;
        const width = rect.right - rect.left;
        // From http://designerstoolbox.com/designresources/banners/
        const bannerSizes = {'468x60': true,
                             '728x90': true,
                             '336x280': true,
                             '300x250': true,
                             '250x250': true,
                             '160x600': true,
                             '120x600': true,
                             '120x240': true,
                             '240x400': true,
                             '234x60': true,
                             '180x150': true,
                             '125x125': true,
                             '120x90': true,
                             '120x60': true,
                             '88x31': true,
                             '120x30': true,
                             '230x33': true,
                             '728x210': true,
                             '720x300': true,
                             '500x350': true,
                             '550x480': true,
                             '300x600': true,
                             '94x15': true}
        return !!bannerSizes[width + 'x' + height];
    }

    /** Return the number of pixels in an image, as a size metric. */
    function numberOfPixels(element) {
        const rect = boundingRect(element);
        return (rect.bottom - rect.top) * (rect.right - rect.left);
    }

    return ruleset(
        // Start with images that aren't banner-sized:
        rule(dom('img').when(fnode => !isBannerSize(fnode.element)), type('comic')),
        rule(type('comic'), score(fnode => numberOfPixels(fnode.element) * coeffSize)),
        rule(type('comic').max(), out('comic'))
    );
}

/**
 * @return {String[]} The name (not path) of each directory directly within a
*      given path
 */
function dirsIn(path) {
  return readdirSync(path).filter(f => statSync(join(path, f)).isDirectory());
}

function readUtf8File(path) {
    return readFileSync(path, {encoding: 'utf8'});
}

if (require.main === module) {
    // By default, just run over the training corpus and show our current
    // score on them.
    const {Annealer} = require('fathom-web/optimizers');
    const {argv} = require('process');

    class Sample {
        constructor(sampleDir) {
            const html = readUtf8File(join(sampleDir, 'source.html'));
            this.name = basename(sampleDir)
            this.doc = staticDom(html);
            this._boundingRects = this._getBoundingRects(this.doc, sampleDir);
        }

        _getBoundingRects(doc, sampleDir) {
            const indexesToRects = JSON.parse(readUtf8File(join(sampleDir, 'nodes.json')));
            const elements = doc.getElementsByTagName('*');
            if (indexesToRects.length !== elements.length) {
                throw `Number of elements in nodes.js (${indexesToRects.length}) does not match number of elements in source.html (${elements.length}).`;
            }

            const elementsToRects = new Map();
            for (let i = 0; i < elements.length; i++) {
                elementsToRects.set(elements[i], indexesToRects[i]);
            }
            return elementsToRects;
        }

        /**
         * Return the getBoundingClientRect() result for the given element, in
         * the initial scroll position (that is, not scrolled at all).
         */
        boundingRect(element) {
            return this._boundingRects.get(element);
        }
    }

    /**
     * A reusable, caching representation of a group of samples
     */
    class Corpus {
        constructor() {
            const baseFolder = this.baseFolder();
            this.samples = new Map();  // folder name -> Sample
            for (const sampleDir of dirsIn(baseFolder)) {
                this.samples.set(sampleDir, new Sample(join(baseFolder, sampleDir)));
            }
        }

        /**
         * Return the path to the folder in which samples live.
         */
        baseFolder() {
            return join(__dirname, 'corpus', 'training');
        }
    }

    /**
     * A run of a ruleset over an entire supervised corpus of pages
     *
     * Builds up a total score and reports it at the end.
     */
    class Run {
        /**
         * Run ruleset against every document in the corpus, and make the final
         * score ready for retrieval by calling score() or humanScore().
         *
         * @arg coeffs {Number[]|undefined} The coefficients by which to
         *     parametrize the ruleset
         */
        constructor(corpus, coeffs) {
            const ruleset = this.ruleset();
            const parametrizedRuleset = coeffs === undefined ? ruleset() : ruleset(...coeffs);
            this.scoreParts = this.initialScoreParts();
            this.corpus = corpus;
            for (this.currentSample of corpus.samples.values()) {
                this.updateScoreParts(this.currentSample, parametrizedRuleset, this.scoreParts);
            }
        }

        /**
         * Return the dimensions of an element in the current sample.
         *
         * This is a dirty trick to get rulesets access to data files inside
         * sample directories without them having to know about the existence
         * of samples, so that we can continue to use a ruleset both inside and
         * outside the tuning harness.
         */
        boundingRectFromCurrentSample(element) {
            return this.currentSample.boundingRect(element);
        }

        /**
         * Return a callable that, given coefficients as arguments, returns a
         * parametrized ruleset.
         */
        ruleset() {
            return (...coeffs) => comicRuleset(this.boundingRectFromCurrentSample.bind(this), ...coeffs);
        }

        initialScoreParts() {
            return {number: 0, numberWrong: 0};
        }

        /**
         * Run the ruleset over the single sample, and update scoreParts.
         *
         * @arg sample An arbitrary data structure that specifies which sample
         *     from the corpus to run against and the expected answer
         */
        updateScoreParts(sample, ruleset, scoreParts) {
            const facts = ruleset.against(sample.doc);
            const comic = facts.get('comic')[0];
            if (comic.element.getAttribute('data-fathom-comic') !== "1") {
                scoreParts.numberWrong += 1;
                // Could we turn this into an "amount wrong" by saying how far (in index (which would consider some "second best" images crazy bad), or in space (maybe better)) the selected element is from the correct one? Maybe favor the cheaper distance function, or just try both and see which leads the optimizer to a set of coeffs with more right answers.
                console.log('Wrong answer for ' + sample.name + ': ' + comic.innerHtml);
            }
            scoreParts.number += 1;
        }

        score() {
            return this.scoreParts.numberWrong;
        }

        humanScore() {
            return (1 - (this.score() / this.scoreParts.number)) * 100;
        }
    }

    class Tuner extends Annealer {
        constructor() {
            super();
            this.corpus = new Corpus();
        }

        solutionCost(coeffs) {
            return new Run(this.corpus, coeffs).score();
        }

        randomTransition(solution) {
            // Nudge a random coefficient in a random direction.
            const ret = solution.slice();
            let element, nudge;

            // Don't let weights go negative. Negative scores make overall
            // scores flip signs spastically. If you want fractional scores in
            // your ruleset, put 1 / coefficient in your ruleset.
            do {
                element = Math.floor(Math.random() * solution.length);
                nudge = Math.floor(Math.random() * 2) ? -1 : 1;
            } while (ret[element] + nudge < 0);

            ret[element] += nudge;
            return ret;
        }

        initialSolution() {
            // Best-scoring coeffs so far:
            return [10];  // From here, they can go up or down. This should let us get to a solution where most coeffs are high and a few are low faster, without any downside.
        }
    }

    if (argv[2] === '--tune') {
        // Tune coefficients using simulated annealing.
        const annealer = new Tuner();
        coeffs = annealer.anneal();
    } else {
        coeffs = [10];
    }
    console.log('Using coefficients', coeffs);
    console.log('% right:', new Run(new Corpus()).humanScore());  // TODO: Replace with validation set once we get a decently high number.
}
