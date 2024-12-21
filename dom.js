/**
 * Class representing user input for finite automata
 */
class UserInput {
  /**
   * Create a UserInput instance
   * @param {string} initialState - The initial state
   * @param {string|string[]} finalStates - The final/accepting state(s)
   * @param {string[]} states - Array of all states
   * @param {string[]} alphabet - Array of input symbols
   * @param {Transition[]} transitions - Array of transitions
   */
  constructor(initialState, finalStates, states, alphabet, transitions) {
    this.initialState = initialState;
    this.finalStates = finalStates;
    this.states = states;
    this.alphabet = alphabet;
    this.transitions = transitions;
  }
}

$(() => {
  // Initially hide verification and DFA sections
  $('#verification-section').hide();
  $('#dfa-conversion-section').hide();

  const transitionsDiv = $('#nfa-transitions');
  const removeButton = $('.remove-button');
  const verifyUpdateDebug = $('#verify-update-debug');

  // Add new transition row
  $('#new-transition').click(() => {
    const clone = $('#nfa-transitions .production-row').last().clone(true);
    clone.find('input').val(''); // Clear input values in cloned row
    clone.appendTo(transitionsDiv);
    $('.remove-button').show();
  });

  // Hide remove buttons initially
  removeButton.hide();

  // Handle remove button clicks
  removeButton.click(function () {
    const parent = $(this).parent();
    const grandparent = parent.parent();

    // Fade out and remove the row
    parent.fadeOut(400, function () {
      $(this).remove();

      // Hide remove buttons if only one row remains
      if (grandparent.children().length <= 1) {
        $('.remove-button').hide();
      }

      // Trigger verification update
      verifyUpdateDebug.click();
    });
  });

  // Handle enter key in input fields
  $('.production-row input').on('keypress', (e) => {
    if (e.which === 13) {
      $('#new-transition').click();
    }
  });

  // Auto-update on input changes
  $('.production-row input').on('keyup', (e) => {
    if (e.which !== 13) {
      verifyUpdateDebug.click();
    }
  });

  $('#initialStateInput, #finalStatesInput').on('keyup', () => {
    verifyUpdateDebug.click();
  });

  // Reset the form
  $('#resetBtn').click(() => {
    $('#initialStateInput, #finalStatesInput').val('');

    // Remove all transition rows except first
    $('#nfa-transitions .production-row:not(:first)').remove();

    // Clear inputs in first row
    $('#nfa-transitions .production-row:first input').val('');

    // Hide remove button
    $('.remove-button').hide();

    // Clear visualizations and hide sections
    $('#current-nfa, #current-dfa, #current-dfa-minimized, #step-div').empty();
    $('#verification-section').hide();
    $('#dfa-conversion-section').hide();

    // Trigger verification update
    verifyUpdateDebug.click();
  });

  // Update visualization
  verifyUpdateDebug.click(() => {
    const userInput = fetchUserInput();
    if (!userInput) {
      $('#verification-section').hide();
      $('#dfa-conversion-section').hide();
      return;
    }

    // Show verification section and generate NFA visualization
    $('#verification-section').show();
    const nfaDot = generateNFADot(userInput);
    d3.select('#current-nfa').graphviz().zoom(false).renderDot(nfaDot);

    // Generate and visualize DFA
    const nfa = new NFA(
      userInput.initialState,
      userInput.finalStates,
      userInput.states,
      userInput.alphabet,
      userInput.transitions
    );

    const dfa = generateDFA(nfa);
    if (dfa) {
      $('#dfa-conversion-section').show();
      updateStepButtons();
      visualizeDFA(dfa);

      // Generate and visualize minimized DFA
      const minDFA = minimizeDFA(dfa);
      visualizeMinimizedDFA(minDFA);
    } else {
      $('#dfa-conversion-section').hide();
    }
  });

  // Handle step button clicks
  $('#step-div').on('click', 'button', function () {
    const step = $(this).data('step-number');
    const userInput = fetchUserInput();
    if (!userInput) return;

    $(this).parent().find('button').removeClass('active');
    $(this).addClass('active');

    const nfa = new NFA(
      userInput.initialState,
      userInput.finalStates,
      userInput.states,
      userInput.alphabet,
      userInput.transitions
    );

    const dfa = generateDFA(nfa, step);
    visualizeDFA(dfa);

    $('#current-dfa-minimized').toggle(step === LAST_COMPLETED_STEP_COUNT + 1);
  });

  /**
   * Fetches and validates user input from the form
   * @returns {UserInput|null} The user input object or null if validation fails
   */
  const fetchUserInput = () => {
    const initialState = $('#initialStateInput').val().trim();
    let finalStates = $('#finalStatesInput').val().trim();
    const states = new Set();
    const alphabet = new Set();
    const transitions = [];

    if (!initialState || !finalStates) return null;

    if (initialState.includes('{') || finalStates.includes('{')) {
      alert('State names cannot contain the "{" character!');
      return null;
    }

    $('.production-row').each(function () {
      const currentState = $(this).find('.current-state-input').val().trim();
      let inputSymbol = $(this).find('.input-symbol').val().trim() || '\u03BB';
      const nextState = $(this).find('.next-states').val().trim();

      if (!currentState || !nextState) return null;

      if (currentState.includes('{') || nextState.includes('{')) {
        alert('State names cannot contain the "{" character!');
        return null;
      }

      transitions.push(new Transition(currentState, nextState, inputSymbol));

      if (inputSymbol !== '\u03BB') {
        alphabet.add(inputSymbol);
      }
      states.add(currentState).add(nextState);
    });

    if (transitions.length === 0) return null;

    finalStates = finalStates.includes(',') ? finalStates.split(',') : finalStates;

    return new UserInput(
      initialState,
      finalStates,
      Array.from(states),
      Array.from(alphabet),
      transitions
    );
  };

  /**
   * Generates DOT string for NFA visualization
   * @param {UserInput} userInput - The user input object
   * @returns {string} DOT format string
   */
  const generateNFADot = (userInput) => {
    let dot = 'digraph fsm {\n';
    dot += 'rankdir=LR;\n';
    dot += 'size="8,5";\n';
    dot += `node [shape = doublecircle]; ${userInput.finalStates};\n`;
    dot += 'node [shape = point]; INITIAL_STATE\n';
    dot += 'node [shape = circle];\n';
    dot += `INITIAL_STATE -> ${userInput.initialState};\n`;

    userInput.transitions.forEach(({ state, nextStates, symbol }) => {
      dot += `${state} -> ${nextStates} [label=${symbol}];\n`;
    });

    return dot + '}';
  };

  /**
   * Updates step buttons based on last completed step
   */
  const updateStepButtons = () => {
    const stepDiv = $('#step-div');
    stepDiv.empty();

    for (let i = 0; i <= LAST_COMPLETED_STEP_COUNT; i++) {
      stepDiv.append(
        `<button class="btn btn-xs btn-outline-info" data-step-number="${i + 1}">Step ${i + 1}</button>`
      );
    }
  };

  /**
   * Visualizes DFA using graphviz
   * @param {DFA} dfa - The DFA to visualize
   */
  const visualizeDFA = (dfa) => {
    d3.select('#current-dfa')
      .graphviz()
      .zoom(false)
      .renderDot(dfa.toDotString());
  };

  /**
   * Visualizes minimized DFA using graphviz
   * @param {DFA} minDFA - The minimized DFA to visualize
   */
  const visualizeMinimizedDFA = (minDFA) => {
    d3.select('#current-dfa-minimized')
      .graphviz()
      .zoom(false)
      .renderDot(minDFA.toDotString());
  };
});