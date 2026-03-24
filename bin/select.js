#!/usr/bin/env node

/**
 * Interactive terminal selector — arrow keys to navigate, enter to select.
 *
 * Usage:
 *   node bin/select.js --prompt "What output type?" --options "Tweet,Blog post,Long-form,Marketing copy,General style"
 *   node bin/select.js --prompt "Feedback mode?" --options "Terminal (keyboard),Browser (click-to-annotate)"
 *   node bin/select.js --prompt "What next?" --options "Accept,Annotate,Compare variants,Test another prompt,Annotate another doc"
 *
 * Outputs the selected option text to stdout. Non-interactive fallback if not a TTY.
 */

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const prompt = getArg('--prompt') || 'Select an option:';
const optionsStr = getArg('--options') || '';
const options = optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);

if (options.length === 0) {
  console.error('No options provided');
  process.exit(1);
}

// Non-interactive fallback
if (!process.stdin.isTTY) {
  console.log(options[0]);
  process.exit(0);
}

let selected = 0;

function render() {
  // Move cursor up to overwrite previous render (except first time)
  process.stdout.write(`\x1b[${options.length + 2}A`);
  process.stdout.write('\x1b[J'); // clear from cursor down

  process.stdout.write(`\x1b[1m${prompt}\x1b[0m\n`);
  process.stdout.write('\x1b[2m(↑↓ to move, enter to select)\x1b[0m\n');

  for (let i = 0; i < options.length; i++) {
    if (i === selected) {
      process.stdout.write(`  \x1b[36m❯ ${options[i]}\x1b[0m\n`);
    } else {
      process.stdout.write(`    ${options[i]}\n`);
    }
  }
}

// Initial render — write the lines first so render() can overwrite them
process.stdout.write(`\x1b[1m${prompt}\x1b[0m\n`);
process.stdout.write('\x1b[2m(↑↓ to move, enter to select)\x1b[0m\n');
for (let i = 0; i < options.length; i++) {
  if (i === selected) {
    process.stdout.write(`  \x1b[36m❯ ${options[i]}\x1b[0m\n`);
  } else {
    process.stdout.write(`    ${options[i]}\n`);
  }
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  // Ctrl+C
  if (key === '\u0003') {
    process.stdout.write('\n');
    process.stdin.setRawMode(false);
    process.exit(130);
  }

  // Enter
  if (key === '\r' || key === '\n') {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    // Clear the menu and print the selection cleanly
    process.stdout.write(`\x1b[${options.length + 2}A`);
    process.stdout.write('\x1b[J');
    process.stdout.write(`${prompt} \x1b[36m${options[selected]}\x1b[0m\n`);
    // Print just the selection to stdout for capture
    console.log(options[selected]);
    process.exit(0);
  }

  // Arrow up or k
  if (key === '\u001b[A' || key === 'k') {
    selected = (selected - 1 + options.length) % options.length;
    render();
  }

  // Arrow down or j
  if (key === '\u001b[B' || key === 'j') {
    selected = (selected + 1) % options.length;
    render();
  }

  // Number keys 1-9 for quick select
  const num = parseInt(key, 10);
  if (num >= 1 && num <= options.length) {
    selected = num - 1;
    render();
  }
});
