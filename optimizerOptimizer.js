const {setDefault} = require('fathom-web/utils');

class Problem {
    constructor() {
        this.costCount = 0;
        this.transitionCount = 0;
    }
}

class StaircaseSine extends Problem {
    initialSolution() {
        return [10, 10, 10, 10];
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
        this.transitionCount += 1;
        const ret = coeffs.slice();
        let element, nudge;

        element = Math.floor(Math.random() * coeffs.length);
        // Don't let weights go negative:
        do {
            nudge = Math.floor(Math.random() * 2) ? -.5 : .5;
        } while (ret[element] + nudge < 0);

        ret[element] += nudge;
        return ret;
    }

    solutionCost(coeffs) {
        this.costCount += 1;
        const x = 1.8;  // arbitrary number at which the function value seems to change when coefficients do. x represents the corpus we're running against: that is constant.
        const [a, b, c, d] = coeffs;
        return Math.round(Math.sin(x) + Math.sin(x * a) + (x / b) - (x / (c + 1))) + d + 4;  // There's no possibility of arbitrarily small values no matter what you set any of a, b, c, and d to (>0). The sins should exercise local min-finding; the rest, global. c+1 moves the -infinity asymptote to the left so non-negative c values won't hit it. +4 is to keep the minimum >0 so geomean works for tuning hyperparams.
    }
}

/**
 * A linear equation in several dimensions. Optimum is at 0
 */
class Linear extends Problem {
    initialSolution() {
        return [10, 10, 10, 10, 10];
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
        this.transitionCount += 1;
        const ret = coeffs.slice();
        let element, nudge;

        element = Math.floor(Math.random() * coeffs.length);
        // Don't let weights go negative:
        do {
            nudge = Math.floor(Math.random() * 2) ? -.5 : .5;
        } while (ret[element] + nudge < 0);

        ret[element] += nudge;
        return ret;
    }

    solutionCost(coeffs) {
        this.costCount += 1;
        const x = 2;
        const [a, b, c, d, e] = coeffs;
        return 3 * a + 4 * b + 1 * c + 9 * d + .5 * e + 1;  // keep it >0 for geomean to work
    }
}

class BinPacking extends Problem {
    constructor() {
        super();
        this.numBins = 30;
    }
    /**
    Initial solution function defines the starting state. Each bin gets 6 items - each
    costing the bin number: bin0 contains 0,0,0,0,0,0  ... bin1 contains 1,1,1,1,1,1  ... binN contains N,N,N,N,N,N
    */
    initialSolution() {
        var bins = [];     // this is the solution state
        for (var i=0; i<this.numBins; i++) {
            bins[i] = [ i, i, i, i, i, i ];
        }
        return bins;
    }

    /**
        how much does a solution cost. Make sure you have a
        metric that measures the effective energy of a solution
    */
    solutionCost(solution) {
        this.costCount += 1;

        // The cost of this solution is the maximum value of items in
        // any bin. If we want an even division - keep this 'cost'
        // low.
        var rc = 0;
        for (var i=0; i<this.numBins; i++) {
            var binTotal = 0;
            for (var j=0; j<solution[i].length; j++){
                binTotal += solution[i][j];
            }
            rc = Math.max( rc,binTotal);
        }
        return (1+rc) * (1+rc) ;
    }

    /**
        Make a random transition - in our case swap an item
        between one bin and another. For large scale solution states
        a better random number generator is recommended (It really is
        important).

        Return the new solution
    */
    randomTransition(solution) {
        this.transitionCount += 1;
        var rc = solution.slice( 0 );
        for (var i = 0; i < rc.length; i++) {
            rc[i] = solution[i].slice(0);
        }
        var bin1  = Math.floor( Math.random() * this.numBins );
        var bin11 = Math.floor( Math.random() * solution[bin1].length );
        var bin2 = Math.floor( Math.random() * this.numBins );
        var bin21 = Math.floor( Math.random() * solution[bin2].length );

        rc[bin1][bin11] = solution[bin2][bin21];
        rc[bin2][bin21] = solution[bin1][bin11];

        return rc;
    }
    /**
        This is purely for niceness/debugging. It's not part of the
        actual annealing
    */
    printSolution(solution) {
        return solution.map( function(e) { return e.reduce( function(p,c){ return p+c;} )}).join( " " );
    }
}

class Annealer {
    constructor(initialTemperature = 5000, coolingSteps = 5000, coolingFraction = .95, stepsPerTemp = 1000) {
        this.INITIAL_TEMPERATURE = initialTemperature;
        this.COOLING_STEPS = coolingSteps;
        this.COOLING_FRACTION = coolingFraction;
        this.STEPS_PER_TEMP = stepsPerTemp;
    }

    /**
     * Iterate over a variety of random solutions for a finite time, and return
     * the best we come up with.
     *
     * @return {number[]} Coefficients we arrived at
     */
    anneal() {
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = this.initialSolution();
        let bestSolution = currentSolution;
        let currentCost = this.solutionCost(currentSolution);
        let bestCost = currentCost;
        let m = 0;
        let n = 0;
        let hits = 0, misses = 0;
        const seenSolutions = new Map();  // solution => cost
        for (let i = 0; i < this.COOLING_STEPS; i++) {
            //console.log('Cooling step', i, 'of', this.COOLING_STEPS, '...');
            const startCost = currentCost;
            for (let j = 0; j < this.STEPS_PER_TEMP; j++) {
                let newSolution = this.randomTransition(currentSolution);
                if (seenSolutions.has(newSolution.toString())) {
                    hits += 1;
                } else {
                    misses += 1;
                }
                let newCost = setDefault(seenSolutions, newSolution.toString(), () => this.solutionCost(newSolution));

                if (newCost < currentCost) {
                    // Always take improvements.
                    currentCost = newCost;
                    currentSolution = newSolution;
                    if (newCost < bestCost) {
                        bestCost = newCost;
                        bestSolution = newSolution;
                        //console.log('New best solution is ', newSolution, ' with cost ', newCost);
                    }
                } else {
                    // Sometimes take non-improvements.
                    const minusDelta = currentCost - newCost;
                    const merit = Math.exp(minusDelta / temperature);
                    if (merit > Math.random()) {
                        m++;
                        currentCost = newCost;
                        currentSolution = newSolution;
                    }
                }
                n++;
                // Exit if we're not moving:
                if (startCost === currentCost) { break; }
            }
            temperature *= this.COOLING_FRACTION;
        }
        //console.log('Iterations:', n, 'using', m, 'jumps.');
        //console.log('Cache hits', hits, 'misses', misses);
        return bestSolution;
    }
}

class OriginalAnnealer {
    constructor() {
        this.INITIAL_TEMPERATURE = 5000;
        this.COOLING_STEPS = 5000;
        this.COOLING_FRACTION = 0.95;
        this.STEPS_PER_TEMP = 1000;
        this.BOLTZMANNS = 1.3806485279e-23;
    }

    /**
     * Iterate over a variety of random solutions for a finite time, and return
     * the best we come up with.
     *
     * @return {number[]} Coefficients we arrived at
     */
    anneal() {
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = this.initialSolution();
        let currentCost = this.solutionCost(currentSolution);
        let m = 0;
        let n = 0;
        for (let i = 0; i < this.COOLING_STEPS; i++) {
            //console.log('Cooling step', i, 'of', this.COOLING_STEPS, '...');
            const startCost = currentCost;
            for (let j = 0; j < this.STEPS_PER_TEMP; j++) {
                let newSolution = this.randomTransition(currentSolution);
                let newCost = this.solutionCost(newSolution);

                if (newCost < currentCost) {
                    currentCost = newCost;
                    currentSolution = newSolution;
                    //console.log('New best solution is ', newSolution, ' with fitness ', newCost);
                } else {
                    const minusDelta = currentCost - newCost;
                    const merit = Math.exp(minusDelta / (this.BOLTZMANNS * temperature));
                    if (merit > Math.random()) {
                        m++;
                        currentCost = newCost;
                        currentSolution = newSolution;
                    }
                }
                n++;
                // Exit if we're not moving:
                if (startCost === currentCost) { break; }
            }
            temperature *= this.COOLING_FRACTION;
        }
        //console.log('Iterations:', n, 'using', m, 'jumps.');
        return currentSolution;
    }
}

class BestSolutionAnnealer {
    constructor() {
        this.INITIAL_TEMPERATURE = 5000;
        this.COOLING_STEPS = 5000;
        this.COOLING_FRACTION = 0.95;
        this.STEPS_PER_TEMP = 1000;
        this.BOLTZMANNS = 1.3806485279e-23;
    }

    /**
     * Iterate over a variety of random solutions for a finite time, and return
     * the best we come up with.
     *
     * @return {number[]} Coefficients we arrived at
     */
    anneal() {
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = this.initialSolution();
        let currentCost = this.solutionCost(currentSolution);
        let bestCost = currentCost;
        let bestSolution = currentSolution;
        let m = 0;
        let n = 0;
        for (let i = 0; i < this.COOLING_STEPS; i++) {
            //console.log('Cooling step', i, 'of', this.COOLING_STEPS, '...');
            const startCost = currentCost;
            for (let j = 0; j < this.STEPS_PER_TEMP; j++) {
                let newSolution = this.randomTransition(currentSolution);
                let newCost = this.solutionCost(newSolution);

                if (newCost < currentCost) {
                    currentCost = newCost;
                    currentSolution = newSolution;
                    if (newCost < bestCost) {
                        bestSolution = newSolution;
                        bestCost = newCost;
                        console.log('Best so far:', newSolution, 'with cost', newCost);
                    }
                } else {
                    const minusDelta = currentCost - newCost;
                    const merit = Math.exp(minusDelta / (this.BOLTZMANNS * temperature));
                    if (merit > Math.random()) {
                        m++;
                        currentCost = newCost;
                        currentSolution = newSolution;
                    }
                }
                n++;
                // Exit if we're not moving:
                if (startCost === currentCost) { break; }
            }
            temperature *= this.COOLING_FRACTION;
        }
        //console.log('Iterations:', n, 'using', m, 'jumps.');
        return bestSolution;
    }
}

function injectProblem(problem, optimizer) {
    for (const method of ['initialSolution', 'randomTransition', 'solutionCost']) {
        optimizer[method] = problem[method].bind(problem);
    }
}

function costOfOptimizers(optimizers, problems) {
    const costs = [];
    const times = [];
    for (const [name, pClass] of problems.entries()) {
        //console.log('PROBLEM:', name);
        for (const [name, optimizer] of optimizers.entries()) {
            //console.log('OPTIMIZER:', name);
            const problem = new pClass();
            //const optimizer = new oClass();
            injectProblem(problem, optimizer);
            const coeffs = optimizer.anneal();
            //console.log('  Tuned coefficients:', coeffs);
            const cost = optimizer.solutionCost(coeffs);
            //console.log('  Cost:', cost);
            //console.log('  Time:', problem.costCount);
            //console.log('  Iterations:', problem.transitionCount);
            costs.push(cost);
            times.push(problem.transitionCount);
            //console.log(cost, problem.transitionCount);
        }
    }
    // This means the speed has to get about 9x better to let the score get 2x worse.
    const quality = weightedGeoMean(Array(costs.length).fill(3).concat(Array(times.length).fill(1)), costs.concat(times));
    console.log('geomean:', ' '.repeat(quality / 7), Math.floor(quality), '     costs', costs, 'time', times);
    return quality;
}

/**
 * An x% change in any of the numbers will have the same effect. So, bascially,
 * we're weighting ratio changes in all incoming values equally.
 */
function geomean(...numbers) {
    let product = 1;
    for (n of numbers) {
        product *= n;
    }
    return product ** (1 / numbers.length)
}

function weightedGeoMean(weights, data) {
    return Math.exp(weights.reduce((sum, w, i) => sum + (w * Math.log(data[i])), 0) /
                    weights.reduce((sum, w, i) => sum + w, 0));
}

function main() {
    const optimizers = new Map();
    optimizers.set('Annealer', Annealer);
    optimizers.set('OriginalAnnealer', OriginalAnnealer);

    const problems = new Map();
    problems.set('StaircaseSine', StaircaseSine);
    problems.set('BinPacking', BinPacking);

    costOfOptimizers(optimizers, problems);
}

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

class AnnealerTuner extends Annealer {
    initialSolution() {
        return [ 10643.296506954695, 113.30886882813805, 0.023803813406736214, 4.231731642265747 ];
    // Other reasonable but worse-scoring solutions:
    // [ 3848.7282367457, 459.41398728036717, 0.46569119555201544, 53.09744136182902 ];
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
        const ret = coeffs.slice();
        let element, nudge;

        element = Math.floor(Math.random() * coeffs.length);
        //const scales = [100, 100, .05, 100];
        const scales = ret.map(x => x * .05);  // nudge by 5% (dumb for small numbers?)
        // Don't let weights go to zero:
        do {
            nudge = Math.floor(Math.random() * 2) ? -scales[element] : scales[element];
        } while (ret[element] + nudge <= 0);

        ret[element] += nudge;
        return ret;
    }

    solutionCost(coeffs) {
        const problems = new Map();
        problems.set('StaircaseSine', StaircaseSine);
        problems.set('BinPacking', BinPacking);
        problems.set('Linear', Linear);
        const optimizers = new Map();
        optimizers.set('Annealer', new Annealer(...coeffs));
        return costOfOptimizers(optimizers, problems);
    }
}

const tuner = new AnnealerTuner([ 10643.296506954695,
  113.30886882813805,
  0.023803813406736214,
  4.231731642265747 ]);
const coeffs = tuner.anneal();
console.log('Coeffs:', coeffs);
console.log('Cost:', tuner.solutionCost(coeffs));
