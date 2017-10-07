function getDomsAndAnswers() {
    return [1, 2, 3];
}

function howManyWrong(domsAndAnswers, coeffs) {
    return 1;
}

if (require.main === module) {
    // By default, just run over the training corpus and show our current
    // score on them.
    const {Annealer} = require('fathom-web/optimizers');
    const {argv} = require('process');

    // Best-scoring coeffs so far:
    let coeffs = [0, 0, 0, 0];

    class Tuner extends Annealer {
        constructor() {
            super();
            this.solutionCost = coeffs => howManyWrong(getDomsAndAnswers('training'), coeffs);
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
    const domsAndAnswers = getDomsAndAnswers('training');
    console.log('% right:', 100 - (howManyWrong(domsAndAnswers, coeffs) / domsAndAnswers.length * 100));  // TODO: Replace with validation set once we get a decently high number.
}
