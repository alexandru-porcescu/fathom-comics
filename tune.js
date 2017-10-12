const {readFileSync, readdirSync, statSync} = require('fs');
const {jsdom} = require('jsdom/lib/old-api');
const {join} = require('path');

const {dom, props, out, rule, ruleset, score, type} = require('fathom-web');


/**
 * Parse an HTML doc, and return a DOM-compliant interface to it. Do not
 * execute any of its inline scripts.
 */
function staticDom(html) {
    return jsdom(html, {features: {ProcessExternalResources: false,
                                   FetchExternalResources: false}});
}

function comicRuleset(coeffFoo = 0, coeffBar = 0) {
    return ruleset(
        rule(dom('img'), type('smoo').score(fnode => fnode.element.hasAttribute('src') ? fnode.element.getAttribute('src').length : 0)),
        rule(type('smoo').max(), out('comic'))
    );
}

/**
 * @return {String[]} The name (not path) of each directory directly within a
*      given path
 */
function dirsIn(path) {
  return readdirSync(path).filter(f => statSync(join(path, f)).isDirectory());
}

if (require.main === module) {
    // By default, just run over the training corpus and show our current
    // score on them.
    const {Annealer} = require('fathom-web/optimizers');
    const {argv} = require('process');

    // Best-scoring coeffs so far:
    let coeffs = [0, 0];

    /**
     * Build up a total score as we run the ruleset over a supervised corpus.
     */
    class RunAgainstCorpus {
        /**
         * @arg rules {Ruleset} A ruleset, tuned with the coefficients you want
         *     to try
         */
        constructor(rules) {
            this.rules = rules;
            this.scoreParts = {number: 0, numberWrong: 0};
        }

        run() {
            for (const sample of this.corpus(join(__dirname, 'corpus', 'training'))) {
                this.updateScoreParts(sample);
            }
        }

        /**
         * @return An iterable of objects carrying the possibly onLoad-mutated
         *     document HTML, the index of the tag that should represent the
         *     comic, and a human-readable name for the sample.
         */
        *corpus(dir) {
            for (const sampleDir of dirsIn(dir)) {
                const html = readFileSync(join(dir, sampleDir, 'source.html'),
                                          {encoding: 'utf8'});
                yield {name: sampleDir,
                       doc: staticDom(html)}
            }
        }

        /**
         * Run the ruleset over the single sample, and update scoreParts.
         *
         * @arg sample An arbitrary data structure that specifies which sample
         *     from the corpus to run against and the expected answer
         */
        updateScoreParts(sample) {
            const comic = this.rules.against(sample.doc).get('comic')[0];
            if (comic.element.getAttribute('data-fathom-comic') !== 1) {
                this.scoreParts.numberWrong += 1;
                // Could we turn this into an "amount wrong" by saying how far (in index (which would consider some "second best" images crazy bad), or in space (maybe better)) the selected element is from the correct one? Maybe favor the cheaper distance function, or just try both and see which leads the optimizer to a set of coeffs with more right answers.
                console.log('Wrong answer for ' + sample.name + ': ' + comic.innerHtml);
            }
            this.scoreParts.number += 1;
        }

        score() {
            if (this.scoreParts.number === 0) {
                this.run();
            }
            return this.scoreParts.numberWrong;
        }

        humanScore() {
            return (1 - (this.score() / this.scoreParts.number)) * 100;
        }
    }

    class Tuner extends Annealer {
        solutionCost(coeffs) {
            return new RunAgainstCorpus(comicRuleset(...coeffs)).score();
        }

        randomTransition(solution) {
            // Nudge a random coefficient in a random direction.
            console.log('PREV:' + solution);
            const ret = solution.slice();
            let element, nudge;

            // Don't let weights go negative. Negative scores make overall
            // scores flip signs spastically.
            do {
                element = Math.floor(Math.random() * solution.length);
                nudge = Math.floor(Math.random() * 2) ? -1 : 1;
            } while (ret[element] + nudge < 0);

            ret[element] += nudge;
            console.log(ret);
            return ret;
        }

        initialSolution() {
            return coeffs;
        }
    }

    if (argv[2] === '--tune') {
        // Tune coefficients using simulated annealing.
        const annealer = new Tuner();
        coeffs = annealer.anneal();
    }
    console.log('Tuned coefficients:', coeffs);
    console.log('% right:', new RunAgainstCorpus(comicRuleset()).humanScore());  // TODO: Replace with validation set once we get a decently high number.
}
