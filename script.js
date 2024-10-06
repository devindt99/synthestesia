// Mapping QWERTY keys to notes
const noteMap = {
  'q': 'C5', 'w': 'D5', 'e': 'E5', 'r': 'F5', 't': 'G5', 'y': 'A5', 'u': 'B5', 'i': 'C6', 'o': 'D6', 'p': 'E6',
  'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4', 'h': 'A4', 'j': 'B4', 'k': 'C5', 'l': 'D5',
  'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B4'
};

// Function to process individual words (outside parentheses)
function processWord(word, melody) {
  let cleanedWord = word.replace(/[^a-zA-Z]/g, ''); // Remove punctuation to calculate word length
  let duration = getDurationForWordLength(cleanedWord.length); // Determine duration based on word length

  // Process each character in the word (notes)
  for (let i = 0; i < word.length; i++) {
    let char = word[i];

    // Handle punctuation as rests
    const rest = handlePunctuation(char);
    if (rest) {
      melody.push(rest); // Add the rest to the melody
      continue; // Move to the next character
    }

    // Check if it's a valid note character
    let note = noteMap[char.toLowerCase()];
    if (!note) continue;

    // Handle sharps (') and flats (,)
    if (word[i + 1] === "'") {
      note = Tone.Frequency(note).transpose(1).toNote(); // Sharp
      i++; // Move past the sharp symbol
    } else if (word[i + 1] === ',') {
      note = Tone.Frequency(note).transpose(-1).toNote(); // Flat
      i++; // Move past the flat symbol
    }

    const velocity = char === char.toUpperCase() ? 1 : 0.5;

    melody.push({ note, velocity, duration });
  }
}

// Function to process chord groups (words inside parentheses)
function processChordGroup(chordWords, melody) {
  const chordDuration = `${chordWords.length}n`; // Chord duration is based on the number of words
  const chords = chordWords.map(word => {
    const notes = [];
    for (let i = 0; i < word.length; i++) {
      let char = word[i];
      let note = noteMap[char.toLowerCase()];
      if (!note) continue;
      
      // Handle sharps (') and flats (,)
      if (word[i + 1] === "'") {
        note = Tone.Frequency(note).transpose(1).toNote(); // Sharp
        i++; // Move past the sharp symbol
      } else if (word[i + 1] === ',') {
        note = Tone.Frequency(note).transpose(-1).toNote(); // Flat
        i++; // Move past the flat symbol
      }

      notes.push(note); // Add note to chord
    }
    return notes;
  });

  // Add chords to the melody with the appropriate duration
  chords.forEach(chord => {
    melody.push({ note: chord, duration: chordDuration, velocity: 0.8 });
  });
}


function handlePunctuation(char) {
  switch (char) {
    case '—':
      return { note: null, duration: '1n' };
    case '-':
      return { note: null, duration: '2n' }; 
    case '...':
      return { note: null, duration: '3n' }; 
    case '.':
      return { note: null, duration: '4n' }; 
    case '/':
      return { note: null, duration: '5n' }; 
    case '?':
      return { note: null, duration: '6n' }; 
    case '!':
      return { note: null, duration: '7n' }; 
    case '"':
      return { note: null, duration: '8n' };
    case '&':
      return { note: null, duration: '9n' };
    case '$':
      return { note: null, duration: '10n' };
    case '%':
      return { note: null, duration: '11n' };
    case '#':
      return { note: null, duration: '12n' };       
    case '*':
      return { note: null, duration: '13n' };   
    case '=':
      return { note: null, duration: '14n' };
    case '+':
      return { note: null, duration: '14n' };  
    case '^':
      return { note: null, duration: '16n' };    
    default:
      return null;
  }
}

// Function to convert a string to a melody
function stringToMelody(str) {
  const melody = [];
  let isChordGroup = false;
  let chordWords = [];

  const words = str.split(/\s+/); // Split the string into words

  words.forEach((word) => {
    if (word.startsWith('(')) {
      isChordGroup = true; // Start chord group
      chordWords = []; // Reset the chord group
      word = word.replace('(', ''); // Remove the opening parenthesis
    }

    if (word.endsWith(')')) {
      isChordGroup = false; // End chord group
      word = word.replace(')', ''); // Remove the closing parenthesis
      chordWords.push(word); // Add the last word of the chord group
      processChordGroup(chordWords, melody); // Process the entire chord group
      return;
    }

    if (isChordGroup) {
      chordWords.push(word); // Add to chord group if still inside parentheses
    } else {
      processWord(word, melody); // Process normally if not in parentheses
    }
  });

  return melody;
}

// Create the synth globally so it's reused
const synth = new Tone.PolySynth(Tone.Synth).toDestination();

// Function to play the melody using Tone.Transport for accurate timing
function playMelody(melody, bpm) {
  // Clear existing scheduled events and reset the transport position
  console.log("Clearing scheduled events and resetting transport");
  Tone.Transport.cancel();
  Tone.Transport.position = 0; // Reset the transport position to the beginning

  // Set the BPM
  console.log("Setting BPM:", bpm);
  Tone.Transport.bpm.value = bpm;
  let currentTime = 0;

  melody.forEach((item) => {
    if (item.note === null) {
      currentTime += Tone.Time(item.duration).toSeconds(); // Rest for the duration
    } else {
      console.log("Scheduling note:", item.note, "Duration:", item.duration, "Time:", currentTime);
      // Schedule the note using Tone.Transport
      Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(item.note, item.duration, time, item.velocity);
      }, currentTime);
      currentTime += Tone.Time(item.duration).toSeconds(); // Accumulate time based on duration
    }
  });

  // Start the transport
  console.log("Starting transport");
  Tone.Transport.start();
}

// Function to stop the melody
function stopMelody() {
  console.log("Stopping and clearing transport");
  Tone.Transport.stop();
  Tone.Transport.cancel(); // Clear any remaining events
}

// Function to get duration based on word length
function getDurationForWordLength(length) {
  return `${length}n`;  // Return duration as 'lengthn', e.g., 4n, 8n, etc.
}

// Event listener to play melody when button is clicked
document.getElementById('playButton').addEventListener('click', async () => {
  console.log("Play button clicked");

  // Ensure the AudioContext is resumed (handles the autoplay restriction)
  if (Tone.context.state !== 'running') {
    await Tone.start();
    console.log("Tone.js AudioContext started");
  }

  // Get the input string and BPM
  const inputString = document.getElementById('melodyString').value;
  const bpm = parseInt(document.getElementById('bpmInput').value, 10);

  console.log("Input String:", inputString);
  console.log("BPM:", bpm);

  // Convert the string to a melody
  const melody = stringToMelody(inputString);
  console.log("Generated Melody:", melody);
  stopMelody;
  // Play the generated melody
  playMelody(melody, bpm);
});

// Event listener for the stop button to stop the melody
document.getElementById('stopButton').addEventListener('click', () => {
  console.log("Stop button clicked");
  stopMelody();
});

// Event listener to export the melody as MIDI
document.getElementById('exportMidiButton').addEventListener('click', () => {
  console.log("Export MIDI button clicked");

  // Get the input string and BPM
  const inputString = document.getElementById('melodyString').value;
  const bpm = parseInt(document.getElementById('bpmInput').value, 10);

  console.log("Input String for MIDI:", inputString);
  console.log("BPM for MIDI:", bpm);

  // Convert the string to a melody
  const melody = stringToMelody(inputString);
  console.log("Generated Melody for MIDI:", melody);

  // Export the melody as MIDI (implementation stays the same)
  exportMelodyToMIDI(melody, bpm);
});
