const MAX_BYTES = 1 << 20;
const MIN_RUN = 8; 

const isPrintable = b => (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13;


async function loadPixels(file) {
    const bmp = await createImageBitmap(file, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none'
    });
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

//extract lowest bit pixel by pixel and pack back into bytes
function extract(img, channels, msbFirst) {
    const bytes = [];
    let current = 0, count = 0;
    const pixelCount = img.width * img.height;

    for (let p = 0; p < pixelCount && bytes.length < MAX_BYTES; p++) {
        for (const ch of channels) {
            const bit = img.data[p * 4 + ch] & 1;
            if (msbFirst) current = (current << 1) | bit;
            else current |= bit << count;

            if (++count === 8) {
                bytes.push(current);
                current = 0;
                count = 0;
            }
        }
    }
    return Uint8Array.from(bytes);
}

function printablePrefix(buf) {
    let n = 0;
    while (n < buf.length && n < 500 && isPrintable(buf[n])) n++;
    return n;
}


function hasAlpha(img) {
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return true;
    return false;
}

async function scan(file) {
    const out = document.getElementById('results');
    out.textContent = '';

    const add = (tag, text) => {
        const el = document.createElement(tag);
        el.textContent = text;       // textContent, so hidden text can't inject HTML
        out.appendChild(el);
    };


    const alpha = hasAlpha(img);
    add('p', `${file.name}: ${img.width}x${img.height}, transparency used: ${alpha}`);

    // 0=R 1=G 2=B 3=A in canvas pixel data
    const channelSets = { R: [0], G: [1], B: [2], RGB: [0, 1, 2], BGR: [2, 1, 0] };
    if (alpha) {
        channelSets.A = [3];
        channelSets.RGBA = [0, 1, 2, 3];
    }

    let found = false;
    for (const [name, channels] of Object.entries(channelSets)) {
        for (const msbFirst of [true, false]) {
            const buf = extract(img, channels, msbFirst);
            const run = printablePrefix(buf);
            if (run >= MIN_RUN) {
                found = true;
                add('h3', `Likely message: channels ${name}, ${msbFirst ? 'MSB' : 'LSB'}-first (${run} readable bytes)`);
                add('pre', new TextDecoder('utf-8').decode(buf.subarray(0, run)));
            }
        }
    }
}

const fileInput = document.getElementById('file');
const drop = document.getElementById('drop');

fileInput.addEventListener('change', () => fileInput.files[0] && scan(fileInput.files[0]));
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) scan(e.dataTransfer.files[0]);
});