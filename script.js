// Mapping QWERTY keys to notes
const noteMap = {
    'q': 'C5', 'w': 'D5', 'e': 'E5', 'r': 'F5', 't': 'G5', 'y': 'A5', 'u': 'B5', 'i': 'C6', 'o': 'D6', 'p': 'E6',
    'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4', 'h': 'A4', 'j': 'B4', 'k': 'C5', 'l': 'D5',
    'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B4'
  };
  
  // Function to convert a string to a melody
  function stringToMelody(str) {
    const melody = [];
    const chord = [];
    let isChord = false;
    let i = 0;
    let lastNote = null; // Track the last note for repeated patterns
  
    while (i < str.length) {
      let char = str[i];
  
      if (char === '(') {
        isChord = true;  // Start of a chord
        i++;
        continue;
      }
      if (char === ')') {
        isChord = false;  // End of a chord
        if (chord.length > 0) melody.push(chord.slice());
        chord.length = 0;  // Clear chord array
        i++;
        continue;
      }
      if (char === ' ') {
        melody.push({ note: null, duration: '16n' });  // Rest as a 16th note
        i++;
        continue;
      }
  
      if (char === '.') {
        i++;
        continue; // Skip over periods since they are just separators
      }
  
      let note = noteMap[char.toLowerCase()];
      if (!note) {
        i++;
        continue;  // Skip characters that aren't mapped
      }
  
      // Handle sharp and flat
      if (str[i + 1] === "'") {
        note = Tone.Frequency(note).transpose(-1).toNote();  // Flat
        i++;
      } else if (str[i + 1] === '"') {
        note = Tone.Frequency(note).transpose(1).toNote();  // Sharp
        i++;
      }
  
      // Handle dynamics (capital = louder)
      const velocity = char === char.toUpperCase() ? 1 : 0.5;
  
      // Determine the note's duration
      let duration = '4n';  // Default to quarter note
  
      // Check for duration modifiers
      if (str[i + 1] === '-') {
        duration = '2n';  // Half note
        i++;
      } else if (str[i + 1] === '=') {
        duration = '1n';  // Whole note
        i++;
      } else if (i + 1 < str.length && char === str[i + 1]) {
        // Double letter (eighth note)
        duration = '8n';
        i++;
        if (i + 1 < str.length && char === str[i + 1]) {
          // Triple letter (triplet)
          duration = '8t';
          i++;
          if (i + 1 < str.length && char === str[i + 1]) {
            // Quadruple letter (sixteenth note)
            duration = '16n';
            i++;
          }
        }
      }
  
      const noteObj = { note, velocity, duration };
  
      // If a period follows, push the note as an individual item
      if (isChord) {
        chord.push(noteObj);
      } else {
        melody.push(noteObj);
      }
  
      // Reset repeated patterns if a period separates them
      if (str[i + 1] === '.') {
        lastNote = null; // Reset lastNote to break sequences of repeated notes
      } else {
        lastNote = noteObj;
      }
  
      i++;
    }
  
    return melody;
  }
  
  // Function to play the melody
  function playMelody(melody, bpm) {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    let time = 0;
  
    // Set the BPM
    Tone.Transport.bpm.value = bpm;
  
    melody.forEach((item) => {
      if (item.note === null) {
        time += Tone.Time(item.duration).toSeconds();  // Rest for the duration
      } else if (Array.isArray(item)) {
        const notes = item.map(n => n.note);
        const velocities = item.map(n => n.velocity);
        synth.triggerAttackRelease(notes, item[0].duration, Tone.now() + time, velocities[0]);
        time += Tone.Time(item[0].duration).toSeconds();
      } else {
        synth.triggerAttackRelease(item.note, item.duration, Tone.now() + time, item.velocity);
        time += Tone.Time(item.duration).toSeconds();
      }
    });
  }
  
  // Function to export the melody as MIDI, adding rests using the wait attribute
  function exportMelodyToMIDI(melody, bpm) {
    const track = new MidiWriter.Track();
  
    // Set the tempo
    track.setTempo(bpm);
  
    let accumulatedWait = [];  // To accumulate multiple rest durations
  
    melody.forEach((item) => {
      if (item.note === null) {
        // Add the rest duration to the accumulatedWait
        accumulatedWait.push(convertToMidiDuration(item.duration));
      } else if (Array.isArray(item)) {
        const notes = item.map(n => n.note);  // Keep the full note, including octave
        track.addEvent(new MidiWriter.NoteEvent({ pitch: notes, duration: convertToMidiDuration(item[0].duration), wait: accumulatedWait }));
        accumulatedWait = [];  // Reset the accumulatedWait after adding a note
      } else {
        // Add a single note with the accumulated wait time
        track.addEvent(new MidiWriter.NoteEvent({ pitch: item.note, duration: convertToMidiDuration(item.duration), wait: accumulatedWait }));
        accumulatedWait = [];  // Reset the accumulatedWait after adding a note
      }
    });
  
    // Create a write object and download the MIDI file
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
  
  // Convert Tone.js durations to MIDI-compatible durations
  function convertToMidiDuration(duration) {
    const durationMap = {
      '1n': '1',   // Whole note
      '2n': '2',   // Half note
      '4n': '4',   // Quarter note
      '8n': '8',   // Eighth note
      '8t': 't8',  // Triplet eighth note
      '16n': '16'  // Sixteenth note
    };
    return durationMap[duration] || '4'; // Default to quarter note
  }
  
  // Event listener to play melody when button is clicked
  document.getElementById('playButton').addEventListener('click', async () => {
    // Resume the Tone.js AudioContext (handles the browser restriction)
    await Tone.start();
  
    // Get the input string and BPM
    const inputString = document.getElementById('melodyString').value;
    const bpm = parseInt(document.getElementById('bpmInput').value, 10);
  
    // Convert the string to a melody
    const melody = stringToMelody(inputString);
    
    // Play the generated melody
    playMelody(melody, bpm);
  });
  
  // Event listener to export the melody as MIDI
  document.getElementById('exportMidiButton').addEventListener('click', () => {
    // Get the input string and BPM
    const inputString = document.getElementById('melodyString').value;
    const bpm = parseInt(document.getElementById('bpmInput').value, 10);
  
    // Convert the string to a melody
    const melody = stringToMelody(inputString);
    
    // Export the melody as MIDI
    exportMelodyToMIDI(melody, bpm);
  });
  