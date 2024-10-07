// Import Midi from @tonejs/midi
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';

// Define your PPQ (Pulses Per Quarter) for MIDI
const PPQ = 480; // Common value, adjust as needed

// Mapping QWERTY keys to notes
const noteMap = {
  'q': 'C5', 'w': 'D5', 'e': 'E5', 'r': 'F5', 't': 'G5', 'y': 'A5', 'u': 'B5', 'i': 'C6', 'o': 'D6', 'p': 'E6',
  'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4', 'h': 'A4', 'j': 'B4', 'k': 'C5', 'l': 'D5',
  'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B4'
};


const bpm = parseInt(document.getElementById('bpmInput').value, 10);
console.log("BPM: " + bpm);

// Create a new PolySynth instance for playing notes
const synth = new Tone.PolySynth(Tone.Synth).toDestination();

// Function to get ticks per note duration based on BPM
function getDurationInTicks(duration, bpm) {
  const quarterNoteTicks = (60 / bpm) * PPQ;
  // Ensure duration is always positive and non-zero
  console.log(Math.max(quarterNoteTicks * (4 / duration), 1)); 
  return Math.max(quarterNoteTicks * (4 / duration), 1); // Default to 1 tick if too small
}

function getDurationForWordLength(length, bpm) {
  const baseDuration = length === 1 ? 1 : length;
  const ticks = getDurationInTicks(baseDuration, bpm);
  console.log(`Length: ${length}, BPM: ${bpm}, Calculated Ticks: ${ticks}`);
  return ticks;
}
// Function to process individual words (outside parentheses)
function processWord(word, melody, bpm) {
  let duration = getDurationForWordLength(word.replace(/[^a-zA-Z]/g, '').length, bpm);

  for (let i = 0; i < word.length; i++) {
    let char = word[i];
    const rest = handlePunctuation(char);
    if (rest) {
      melody.push({ note: null, duration: getDurationInTicks(rest.duration, bpm) });
      continue;
    }

    let note = noteMap[char.toLowerCase()];
    if (!note) continue;

    if (word[i + 1] === "'") {
      note = Tone.Frequency(note).transpose(1).toNote();
      i++;
    } else if (word[i + 1] === ',') {
      note = Tone.Frequency(note).transpose(-1).toNote();
      i++;
    }

    melody.push({ note, duration });
  }
}

// Function to process chord groups (words inside parentheses)
function processChordGroup(chordWords, melody, bpm) {
  const duration = getDurationForWordLength(chordWords.length, bpm);
  chordWords.forEach(word => {
    let notes = [];
    for (let i = 0; i < word.length; i++) {
      let char = word[i];
      const rest = handlePunctuation(char);
      if (rest) {
        if (notes.length > 0) {
          melody.push({ note: notes, duration });
          notes = [];
        }
        melody.push({ note: null, duration: getDurationInTicks(rest.duration, bpm) });
        continue;
      }

      let note = noteMap[char.toLowerCase()];
      if (!note) continue;

      if (word[i + 1] === "'") {
        note = Tone.Frequency(note).transpose(1).toNote();
        i++;
      } else if (word[i + 1] === ',') {
        note = Tone.Frequency(note).transpose(-1).toNote();
        i++;
      }

      notes.push(note);
    }

    if (notes.length > 0) {
      melody.push({ note: notes, duration });
    }
  });
}

function handlePunctuation(char) {
  switch (char) {
    case '–': return { note: null, duration: 960 }; // half note rest
    case '-': return { note: null, duration: 960 }; // half note rest
    case '.': return { note: null, duration: 480 }; // quarter note rest
    case '&': return { note: null, duration: 240 }; // eighth note rest
    case '?': return { note: null, duration: 120 }; // sixteenth note rest
    case '!': return { note: null, duration: 60 };  // thirty-second note rest
    default: return null;
  }
}

function stringToMelody(str, bpm) {
  const melody = [];
  const segments = str.split(/(\([^)]+\))/);

  segments.forEach(segment => {
      if (segment.startsWith('(') && segment.endsWith(')')) {
          const chordWords = segment.slice(1, -1).split(/\s+/);
          processChordGroup(chordWords, melody, bpm); // Pass bpm here
      } else {
          const words = segment.split(/\s+/);
          words.forEach(word => processWord(word, melody, bpm)); // Pass bpm here
      }
  });

  return melody;
}


// Function to export melody as MIDI
function exportMelodyToMIDI(melody, bpm) {
  const midi = new Midi();
  const track = midi.addTrack();
  midi.header.setTempo(bpm);

  let currentTime = 0;
  melody.forEach(item => {
    const durationTicks = item.duration;

    if (item.note) {
      const notes = Array.isArray(item.note) ? item.note : [item.note];
      notes.forEach(note => {
        track.addNote({
          name: note,
          time: currentTime,
          duration: durationTicks,
          velocity: item.velocity || 0.8,
        });
      });
    }
    currentTime += durationTicks;
  });

  const midiData = midi.toArray();
  const blob = new Blob([new Uint8Array(midiData)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'melody.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}



function playMelody(melody, bpm) {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = bpm;

  let currentTime = 0;

  melody.forEach((item) => {
    if (item.note === null) {
      // For rests, advance by the duration without scheduling any notes
      const restDurationInSeconds = (item.duration / PPQ) * (60 / bpm);
      console.log(`Rest: advancing time by ${restDurationInSeconds} seconds`);
      currentTime += restDurationInSeconds;
    } else {
      const durationInSeconds = (item.duration / PPQ) * (60 / bpm);
      Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(item.note, durationInSeconds, time);
      }, currentTime);

      currentTime += durationInSeconds;
    }
  });

  Tone.Transport.start();
}


console.log("updated");
// Function to stop the melody
function stopMelody() {
  Tone.Transport.stop(); // Stop playback
  Tone.Transport.cancel(); // Clear all scheduled events
  Tone.Transport.position = 0; // Reset position
}

// Event listeners for play and stop buttons
document.getElementById('playButton').addEventListener('click', async () => {
  if (Tone.context.state !== 'running') {
    await Tone.start(); // Ensure AudioContext is resumed
  }

  const inputString = document.getElementById('melodyString').value;
  const bpm = parseInt(document.getElementById('bpmInput').value, 10);

  // Pass bpm to stringToMelody
  const melody = stringToMelody(inputString, bpm);

  playMelody(melody, bpm); // Play the melody with bpm
});


document.getElementById('stopButton').addEventListener('click', stopMelody);

// Event listener to export the melody as MIDI
document.getElementById('exportMidiButton').addEventListener('click', () => {
  const bpm = parseInt(document.getElementById('bpmInput').value, 10);
  const inputString = document.getElementById('melodyString').value;
  const melody = stringToMelody(inputString, bpm);
  exportMelodyToMIDI(melody, bpm);
});