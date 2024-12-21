/**
 * Tracks the number of steps completed in the last DFA generation
 * @type {number}
 */
let LAST_COMPLETED_STEP_COUNT = 0;

/**
 * Represents a transition in a finite automaton
 */
class Transition {
  /**
   * Creates a new Transition
   * @param {string} state - The current state
   * @param {string[]} nextStates - Array of next states
   * @param {string} symbol - The transition symbol
   */
  constructor(state, nextStates, symbol) {
    if (typeof state !== 'string') {
      throw new Error('Expected a single state (string)');
    }

    if (!Array.isArray(nextStates)) {
      console.warn('Expected nextStates in transition to be an array');
      nextStates = [nextStates.toString()];
    }

    if (typeof symbol !== 'string') {
      throw new Error('Expected a string symbol');
    }

    this.state = state;
    this.nextStates = nextStates;
    this.symbol = symbol;
  }
}

/**
 * Represents a Non-deterministic Finite Automaton (NFA)
 */
class NFA {
  /**
   * Creates a new NFA
   * @param {string} initialState - The initial state
   * @param {string[]} finalStates - Array of final/accepting states  
   * @param {string[]} states - Array of all states
   * @param {string[]} alphabet - Array of input symbols
   * @param {Transition[]} transitions - Array of transitions
   */
  constructor(initialState, finalStates, states, alphabet, transitions) {
    if (typeof initialState !== 'string') {
      throw new Error('Expected a single initial state (string)');
    }

    if (!Array.isArray(finalStates)) {
      console.warn('Expected finalStates in NFA to be an array');
      finalStates = [finalStates.toString()];
    }

    if (!Array.isArray(alphabet)) {
      console.warn('Expected alphabet in NFA to be an array');
      alphabet = [alphabet.toString()];
    }

    if (!Array.isArray(transitions)) {
      console.warn('Expected transitions in NFA to be an array');
      transitions = [transitions];
    }

    this.initialState = initialState;
    this.finalStates = finalStates;
    this.states = states;
    this.alphabet = alphabet;
    this.transitions = transitions;
  }

  /**
   * Converts the NFA to DOT format for visualization
   * @returns {string} DOT format string representation
   */
  toDotString() {
    const dotLines = [
      'digraph fsm {',
      'rankdir=LR;',
      'size="8,5";',
      'node [shape = point]; INITIAL_STATE',
      `node [shape = doublecircle]; ${this.finalStates.join(',')};`,
      'node [shape = circle];',
      `INITIAL_STATE -> ${this.formatDotState(this.initialState)};`
    ];

    this.transitions.forEach(t => {
      dotLines.push(
        `${this.formatDotState(t.state)} -> ${this.formatDotState(t.nextStates)} [label=${t.symbol}];`
      );
    });

    dotLines.push('}');
    return dotLines.join('\n');
  }

  /**
   * Formats a state for DOT representation
   * @param {string} stateStr - State to format
   * @returns {string} Formatted state string
   */
  formatDotState(stateStr) {
    stateStr = stateStr.toString();
    if (isMultiState(stateStr)) {
      return stateStr.slice(1, -1).replace(/,/g, '');
    }
    return stateStr;
  }

  /**
   * Generates a transition table for the DFA
   * @returns {string} HTML table representation of transitions
   */
  generateTransitionTable() {
    let tableHtml = '<table class="table table-bordered table-hover"><thead><tr><th>State</th>';

    // Add alphabet symbols as column headers
    this.alphabet.forEach(symbol => {
      tableHtml += `<th>${symbol}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Add rows for each state
    this.states.forEach(state => {
      tableHtml += `<tr><td>${this.formatDotState(state)}</td>`;

      this.alphabet.forEach(symbol => {
        const nextStates = findNextStates(state, symbol, this.transitions);
        const nextState = nextStates.length > 0 ? this.formatDotState(nextStates[0]) : '-';
        tableHtml += `<td>${nextState}</td>`;
      });

      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    return tableHtml;
  }
}

/**
 * Computes lambda closure of an NFA
 * @param {NFA} nfa - Input NFA
 * @returns {NFA} NFA with lambda transitions eliminated
 */
function lambdaClosureNFA(nfa) {
  const hasLambda = nfa.transitions.some(t => t.symbol === '' || t.symbol === '\u03BB');
  if (!hasLambda) return nfa;

  const nfaClosedTransitions = [];

  nfa.states.forEach(state => {
    const stateClosure = fetch_E_Closure(state, nfa.transitions);
    console.debug(`Lambda-closure of ${state}: ${stateClosure}`);

    nfa.alphabet.forEach(symbol => {
      const symbolNextStates = [];

      stateClosure.forEach(closureState => {
        const nextStates = findNextStates(closureState, symbol, nfa.transitions);

        nextStates.forEach(nextState => {
          const closure = fetch_E_Closure(nextState, nfa.transitions);
          closure.forEach(toAdd => {
            if (!symbolNextStates.includes(toAdd)) {
              symbolNextStates.push(toAdd);
            }
          });
        });
      });

      symbolNextStates.sort();
      console.log(`NFA Closure: ${state} -> ${symbol} = ${symbolNextStates} (Length ${symbolNextStates.length})`);
      nfaClosedTransitions.push(new Transition(state, symbolNextStates, symbol));
    });
  });

  // Handle special case for lambda from initial state to final state
  const initialStateClosure = fetch_E_Closure(nfa.initialState, nfa.transitions);
  const initClosureHasFinalState = nfa.finalStates.some(fs => initialStateClosure.includes(fs));

  if (initClosureHasFinalState) {
    nfa.finalStates.push(nfa.initialState);
  }

  const newNfa = new NFA(
    nfa.initialState,
    nfa.finalStates,
    nfa.states,
    nfa.alphabet,
    nfaClosedTransitions
  );

  console.log('--- Lambda NFA ---');
  console.log(newNfa.toDotString());
  console.log('--___--');

  return newNfa;
}

/**
 * Computes epsilon closure of a state
 * @param {string} state - Input state
 * @param {Transition[]} transitions - NFA transitions
 * @returns {string[]} Epsilon closure states
 */
function fetch_E_Closure(state, transitions) {
  if (typeof state !== 'string') {
    throw new Error('Expected a single state input as a string');
  }

  if (!Array.isArray(transitions)) {
    throw new Error('Expected transitions parameter to be an array');
  }

  const eClosure = [state];

  transitions.forEach(t => {
    if (t.symbol.trim() === '' || t.symbol.trim() === '\u03BB') {
      if (state === t.state) {
        if (!Array.isArray(t.nextStates)) {
          throw new Error('Expected nextStates in NFA to be an array');
        }

        t.nextStates.forEach(nextState => {
          if (!eClosure.includes(nextState)) {
            eClosure.push(nextState);
            const subEClosure = fetch_E_Closure(nextState, transitions);
            subEClosure.forEach(s => {
              if (!eClosure.includes(s)) {
                eClosure.push(s);
              }
            });
          }
        });
      }
    }
  });

  return eClosure;
}

/**
 * Converts NFA to DFA using subset construction
 * @param {NFA} nfa - Input NFA
 * @param {number} stepCounterStop - Optional step limit (-1 for no limit)
 * @returns {NFA} Equivalent DFA
 */
function generateDFA(nfa, stepCounterStop = -1) {
  let stepCounter = 0;
  let stepInterrupt = false;

  nfa = lambdaClosureNFA(nfa);

  const dfaStates = [nfa.initialState];
  const dfaFinalStates = [];
  const dfaTransitions = [];
  const stack = [nfa.initialState];

  while (stack.length > 0) {
    const state = stack.pop();
    console.log(`Pop'd state: ${state}`);

    if (++stepCounter === stepCounterStop) {
      stepInterrupt = true;
      break;
    }

    const states = isMultiState(state) ? separateStates(state) : [state];

    nfa.alphabet.forEach(symbol => {
      const nextStatesUnion = [];

      states.forEach(s => {
        const ns = findNextStates(s, symbol, nfa.transitions);
        ns.forEach(n => {
          if (!nextStatesUnion.includes(n)) nextStatesUnion.push(n);
        });
      });

      const combinedStatesUnion = combineStates(nextStatesUnion);

      if (combinedStatesUnion) {
        console.log(`${state}, ${symbol} -> ${combinedStatesUnion}`);
        dfaTransitions.push(new Transition(state, combinedStatesUnion, symbol));

        if (!dfaStates.includes(combinedStatesUnion)) {
          dfaStates.push(combinedStatesUnion);
          stack.push(combinedStatesUnion);
        }
      } else {
        console.log('TRAP state needed');

        if (!dfaStates.includes('TRAP')) {
          nfa.alphabet.forEach(a =>
            dfaTransitions.push(new Transition('TRAP', ['TRAP'], a))
          );
          dfaStates.push('TRAP');
        }

        dfaTransitions.push(new Transition(state, ['TRAP'], symbol));
      }
    });
  }

  console.log('--- NFA Final States ---');
  console.log(nfa.finalStates);
  console.log('-----');

  dfaStates.forEach(dfaState => {
    const dfaSepStates = separateStates(dfaState);
    const isFinal = nfa.finalStates.some(fs => dfaSepStates.includes(fs));
    if (isFinal) {
      dfaFinalStates.push(nfa.formatDotState(dfaState));
    }
  });

  if (!stepInterrupt) {
    LAST_COMPLETED_STEP_COUNT = stepCounter;
    console.log(`LAST_COMPLETED_STEP_COUNT = ${stepCounter}`);
  }

  const dfa = new NFA(
    nfa.initialState,
    dfaFinalStates,
    dfaStates,
    nfa.alphabet,
    dfaTransitions
  );

  // Generate and display transition table
  const transitionTable = dfa.generateTransitionTable();
  document.getElementById('dfa-transition-table').innerHTML = transitionTable;

  return dfa;
}

/**
 * Minimizes a DFA by combining equivalent states
 * @param {NFA} dfa - Input DFA
 * @returns {NFA} Minimized DFA
 */
function minimizeDFA(dfa) {
  console.log('TIME TO MINIMIZE!');

  dfa.states.forEach(state => {
    dfa.states.forEach(state2 => {
      if (
        state !== state2 &&
        dfa.finalStates.includes(dfa.formatDotState(state)) ===
        dfa.finalStates.includes(dfa.formatDotState(state2))
      ) {
        let statesEqual = true;

        for (const symbol of dfa.alphabet) {
          const state1NextStates = findNextStates(state, symbol, dfa.transitions);
          const state2NextStates = findNextStates(state2, symbol, dfa.transitions);

          if (!arraysEqual(state1NextStates, state2NextStates)) {
            statesEqual = false;
          }
        }

        if (statesEqual) {
          let [remove, replace] = [state, state2];

          if (dfa.initialState === remove) {
            [remove, replace] = [state2, state];
          }

          console.log(`The two states are equal [${remove} = ${replace}]`);

          if (remove === 'TRAP') {
            console.log('Trap state will not be removed.');
            return;
          }

          console.log(dfa.states);
          console.log(`Delete ${remove}`);

          dfa.states = dfa.states.filter(s =>
            dfa.formatDotState(s) !== dfa.formatDotState(remove)
          );

          dfa.transitions = dfa.transitions.filter(t => {
            if (t.state !== remove) {
              if (t.nextStates[0] === remove) {
                t.nextStates[0] = replace;
              }
              return true;
            }
            return false;
          });

          dfa.finalStates = dfa.finalStates.filter(s =>
            dfa.formatDotState(s) !== dfa.formatDotState(remove)
          );
        }
      }
    });
  });

  return dfa;
}

/**
 * Finds next states for a given state and input symbol
 * @param {string} state - Current state
 * @param {string} symbol - Input symbol
 * @param {Transition[]} transitions - Array of transitions
 * @returns {string[]} Array of next states
 */
function findNextStates(state, symbol, transitions) {
  return transitions
    .filter(t => t.state === state && t.symbol === symbol)
    .reduce((acc, t) => {
      t.nextStates.forEach(ns => {
        if (!acc.includes(ns)) {
          acc.push(ns);
        }
      });
      return acc;
    }, []);
}

/**
 * Checks if a state represents multiple states
 * @param {string} state - State to check
 * @returns {boolean} True if state is a multi-state
 */
const isMultiState = state =>
  state.toString().startsWith('{') && state.toString().endsWith('}');

/**
 * Separates a multi-state into individual states
 * @param {string} state - State to separate
 * @returns {string[]} Array of individual states
 */
const separateStates = state =>
  isMultiState(state) ? state.substring(1, state.length - 1).split(',') : state;

/**
 * Combines multiple states into a single state representation
 * @param {string[]} states - States to combine
 * @returns {string} Combined state representation
 */
function combineStates(states) {
  if (!Array.isArray(states)) {
    throw new Error('Array expected for combineStates() function');
  }

  states = states.filter(e => e != null);

  if (states.length > 0 && Array.isArray(states[0])) {
    console.warn('Sub-arrays are not expected for combineStates() function');
    states = states[0];
  }

  if (states.length === 0) return null;

  states.sort();

  if (states.length === 1) return states[0].toString();

  return `{${states.join(',')}}`;
}

/**
 * Checks if two arrays are equal
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
};