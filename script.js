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
  // Calculate the duration for each item based on the number of items in the group
  const numItems = chordWords.length;
  const duration = getDurationForWordLength(numItems); // Use the same duration logic as for individual words

  chordWords.forEach(word => {
    let notes = [];

    for (let i = 0; i < word.length; i++) {
      let char = word[i];

      // Check for rests within the chord
      const rest = handlePunctuation(char);
      if (rest) {
        // Push the current notes as a chord if there are any accumulated notes
        if (notes.length > 0) {
          melody.push({ note: notes, duration: duration, velocity: 0.8 });
          notes = []; // Reset the notes array for the next chord
        }
        // Add the rest directly to the melody
        melody.push({ note: null, duration: rest.duration });
        continue; // Continue to the next character in the word
      }

      // Process notes and add them to the 'notes' array to form a chord
      let note = noteMap[char.toLowerCase()];
      if (!note) continue;

      // Handle sharps (') and flats (,)
      if (word[i + 1] === "'") {
        note = Tone.Frequency(note).transpose(1).toNote();
        i++;
      } else if (word[i + 1] === ',') {
        note = Tone.Frequency(note).transpose(-1).toNote();
        i++;
      }

      notes.push(note); // Add the note to the current chord
    }

    // Push any remaining notes as a chord if there are any left at the end
    if (notes.length > 0) {
      melody.push({ note: notes, duration: duration, velocity: 0.8 });
    }
  });
}

function handlePunctuation(char) {
  switch (char) {
    case '—':
      return { note: null, duration: '1n' };
    case '-':
      return { note: null, duration: '2n' }; 
    case '.':
      return { note: null, duration: '4n' }; 
    case '&':
      return { note: null, duration: '8n' };
    case '?':
      return { note: null, duration: '16n' };
    case '!':
      return { note: null, duration: '32n' };    
    default:
      return null;
  }
}

// Function to convert a string to a melody
function stringToMelody(str) {
  const melody = [];
  const segments = str.split(/(\([^)]+\))/); // Split the string by chords (parentheses)

  segments.forEach(segment => {
    if (segment.startsWith('(') && segment.endsWith(')')) {
      // If the segment is a chord, remove the parentheses and process as a chord group
      const chordWords = segment.slice(1, -1).split(/\s+/); // Remove parentheses and split by spaces
      processChordGroup(chordWords, melody);
    } else {
      // Otherwise, split the segment by spaces and process each word
      const words = segment.split(/\s+/);
      words.forEach(word => {
        // If a word includes parentheses inside it, handle accordingly
        const nestedSegments = word.split(/(\([^)]+\))/);

        nestedSegments.forEach(nestedSegment => {
          if (nestedSegment.startsWith('(') && nestedSegment.endsWith(')')) {
            const chordWords = nestedSegment.slice(1, -1).split(/\s+/); // Process inner chords
            processChordGroup(chordWords, melody);
          } else {
            // Process as a normal word
            processWord(nestedSegment, melody);
          }
        });
      });
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
  if (length === 1) {
    return '1n'; // Whole note
  } else if (length <= 2) {
    return '2n'; // Half note
  } else if (length <= 4) {
    return '4n'; // Quarter note
  } else if (length <= 8) {
    return '8n'; // Eighth note
  } else if (length <= 16) {
    return '16n'; // Sixteenth note
  } else {
    return '32n'; // Thirty-second note
  }
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

// Function to export the melody as MIDI, adding rests using the wait attribute
function exportMelodyToMIDI(melody, bpm) {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);

  let accumulatedWait = []; // For accumulated rests
  melody.forEach((item) => {
    const duration = convertToMidiDuration(item.duration);

    // Check if the item is a rest
    if (item.note === null) {
      // If it’s a rest, accumulate its duration in the wait attribute
      accumulatedWait.push(duration);
    } else {
      // If it’s a note, include any accumulated rests before the note
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: item.note,
        duration: duration,
        wait: accumulatedWait, // Wait for any accumulated rests
      }));
      accumulatedWait = []; // Reset accumulated rests after a note
    }
  });

  const write = new MidiWriter.Writer(track);
  const midiData = write.buildFile();
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'melody.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Convert Tone.js durations to MIDI-compatible durations by removing the 'n'
function convertToMidiDuration(duration) {
  // Remove the 'n' from the duration string
  const midiDuration = duration.replace('n', '');
  
  // Check if the duration is valid
  if (!['1', '2', '4', '8', '16', '32'].includes(midiDuration)) {
    console.error(`Unexpected duration value encountered: ${midiDuration}`);
    return '4'; // Default to quarter note if unrecognized
  }
  
  return midiDuration;
}

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
