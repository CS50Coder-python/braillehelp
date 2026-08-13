const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || '';
const INTERVAL_MS = Number(process.env.INTERVAL_MS) || 3000;

if (!API_KEY) {
    console.warn('[WARN] API_KEY is not set, unathourized access risk');
}

let state = { reading_speed: 50, mistakes: 50, rereads: 50, word_count: 200, duration: '01:00' };

function drift(value, min = 0, max = 100, maxStep = 8) {
    const step = Math.round((Math.random() * 2 - 1) * maxStep);
    return Math.min(max, Math.max(min, value + step));
}

// Also hard-caps at 99 minutes: the server's MM:SS validator only accepts
// 1-2 digits for the minute part, so anything above that would be rejected
// with a 400 regardless of how realistic the underlying formula is.
function minutesToDuration(totalMinutes) {
    const safeTotal = Math.min(Math.max(0, totalMinutes), 99.99);
    let mins = Math.floor(safeTotal);
    let secs = Math.round((safeTotal - mins) * 60);

    if (secs === 60) {
        secs = 0;
        mins += 1;
    }

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function nextFakeReading() {
    const readingSpeed = drift(state.reading_speed, 20, 100, 8); // wpm
    const wordCount = drift(state.word_count, 50, 600, 20);
    const rereads = drift(state.rereads);

    // Mistakes can't realistically exceed the number of words in the passage —
    // clamp so `word_count - mistakes` (correctly read words) never goes negative.
    const mistakes = Math.min(drift(state.mistakes), wordCount);

    const safeWpm = readingSpeed; // always >= 20 now, no need for the old 0-guard

    // Baseline pace with no mistakes: how long word_count words take at readingSpeed wpm.
    const durationWithoutMistakes = wordCount / safeWpm;

    // Every mistake adds a proportional re-reading penalty on top of the baseline pace.
    const durationMinutes = durationWithoutMistakes + mistakes * (durationWithoutMistakes / safeWpm);

    // mistakes == 0 means "no errors" — fall back to 1 in the denominator only for the
    // ratio so we report a (large but finite) ratio instead of Infinity.
    const mistakesForRatio = mistakes > 0 ? mistakes : 1;
    const correctWords = wordCount - mistakes;
    const mistakeRatio = Number((correctWords / mistakesForRatio).toFixed(3));

    state = {
        reading_speed: readingSpeed,
        mistakes,
        rereads,
        word_count: wordCount,
        mistake_ratio: mistakeRatio,
        duration: minutesToDuration(durationMinutes)
    };
    return state;
}

async function sendFakeReading() {
    const payload = nextFakeReading();

    try {
        const response = await fetch(`${API_BASE_URL}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY ? { 'X-Api-Key': API_KEY } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            console.error(`[${new Date().toLocaleTimeString()}] Error ${response.status}:`, body.error || response.statusText);
            return;
        }

        console.log(`[${new Date().toLocaleTimeString()}] Sent:`, payload);
    } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Couldn't send data:`, err.message);
    }
}

console.log(`Mock process started, sending data to ${API_BASE_URL}/update every ${INTERVAL_MS}ms. Ctrl+C to stop.`);

sendFakeReading();
const timer = setInterval(sendFakeReading, INTERVAL_MS);

process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('\nStopped.');
    process.exit(0);
});