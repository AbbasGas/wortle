// HTML elements
let UI = {
    main: document.querySelector('main'),
    keyboard: document.querySelector('keyboard'),
    message: document.querySelector('#message'),
    messages: {
        idle: 'Viel Glück.',
        won: 'Gewonnen in %i Versuchen!',
        lost: 'Verloren. Das Wort war %s.'
    },
    cells: []
}

// alphabet for letter parsing
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// determines how many tries per word relative to word length
// e.g. with a 5 letter word, AMOUNT_TRIES = 2 would mean 10 tries
const AMOUNT_TRIES = 1.5

// list of words
let wordlist

// current word
let word

// amount of guesses (gets determined by wordlength)
let guesses

// currently selected cell for typing
let cell_selection

// game state
let gameover

// load words an start
async function setup() {
    // load words
    let words = await fetch('wordlist.json')
    words = await words.json()
    wordlist = words.words

    // inject character preview
    ALPHABET.split('').forEach(char => {
        let el_char = document.createElement('char')
        el_char.setAttribute('checked', 'false')
        el_char.textContent = char
        UI.keyboard.append(el_char)
    })

    // start
    reset()
}

// reset the round
function reset(given_word) {
    // reset game state
    gameover = false

    // pick random word
    word = given_word?.toUpperCase() || random_word()

    // set status message
    UI.message.textContent = UI.messages.idle
    UI.message.className = ''

    // set amount of guesses based on word length
    guesses = Math.ceil(word.length * AMOUNT_TRIES)

    // clear grid
    UI.cells.forEach(row => row.forEach(cell => cell.remove()))
    UI.cells = []

    // create rows and cells
    for (let y = 0; y < guesses; y++) {
        // create new row
        let row = document.createElement('row')
        row.setAttribute('y', y)
        UI.cells.push([])

        for (let x = 0; x < word.length; x++) {
            // create new cell
            let cell = document.createElement('cell')
            cell.setAttribute('x', x)
            cell.setAttribute('y', y)
            cell.setAttribute('selected', 'false')
            cell.setAttribute('enabled', 'false')

            // add eventlistener
            cell.addEventListener('click', c => {
                if (gameover || cell.getAttribute('enabled') == 'false') return

                // select cell on click
                if (cell_selection) cell_selection.setAttribute('selected', 'false')
                cell.setAttribute('selected', 'true')
                cell_selection = cell
            })

            // append to row
            row.append(cell)
            UI.cells[y].push(cell)
        }

        // append to body
        UI.main.append(row)
    }

    // enable input on first row
    UI.cells[0].forEach(row => row.setAttribute('enabled', 'true'))

    // set selected cell to first cell
    cell_selection = UI.cells[0][0]
    UI.cells[0][0].setAttribute('selected', 'true')

    // reset character preview
    document.querySelectorAll('keyboard char').forEach(char => char.setAttribute('checked', 'false'))
}

// handle arrow and alphabetic keys
document.addEventListener('keydown', event => {
    if (gameover) return

    // current cell selection x and y coordinates
    let selection = {
        x: parseInt(cell_selection.getAttribute('x')),
        y: parseInt(cell_selection.getAttribute('y'))
    }

    // decide action based on key 
    if (event.key === 'ArrowRight' && selection.x < word.length - 1) {
        // move right
        cell_selection.setAttribute('selected', 'false')
        cell_selection = UI.cells[selection.y][selection.x + 1]
        cell_selection.setAttribute('selected', 'true')
    } else if (event.key === 'ArrowLeft' && selection.x > 0) {
        // move left
        cell_selection.setAttribute('selected', 'false')
        cell_selection = UI.cells[selection.y][selection.x - 1]
        cell_selection.setAttribute('selected', 'true')
    } else if (event.key === 'Backspace') {
        // delete textContent
        cell_selection.textContent = ''

        if (selection.x > 0) {
            // move left if not already leftmost
            cell_selection.setAttribute('selected', 'false')
            cell_selection = UI.cells[selection.y][selection.x - 1]
            cell_selection.setAttribute('selected', 'true')
        }
    } else if (event.key === 'Delete') {
        // delete textContent without moving
        cell_selection.textContent = ''
    } else if (ALPHABET.includes(event.key.toUpperCase()) && cell_selection && cell_selection.getAttribute('enabled') == 'true') {
        // change text
        cell_selection.textContent = event.key.toUpperCase()

        // move to right cell if this one's not the last in row
        if (selection.x < word.length - 1) {
            cell_selection.setAttribute('selected', 'false')
            cell_selection = UI.cells[selection.y][selection.x + 1]
            cell_selection.setAttribute('selected', 'true')
        }
    } else if (event.key === 'Enter') submit_row()
})

// submit the guess
function submit_row() {
    // current cell selection x and y coordinates
    let selection = {
        x: parseInt(cell_selection.getAttribute('x')),
        y: parseInt(cell_selection.getAttribute('y'))
    }

    if (UI.cells[selection.y].filter(cell => cell.textContent.length > 0).length == UI.cells[selection.y].length) {
        // deselect cell
        cell_selection.setAttribute('selected', 'false')

        // get string of current guess
        let guess = get_text(selection.y)

        // set checked on all guessed characters
        guess.split('').forEach(char =>
            document.querySelectorAll('keyboard char[checked="false"]').forEach(el_char => {
                if (el_char.textContent === char) el_char.setAttribute('checked', 'true')
            })
        )

        // check if won
        if (guess === word) {
            // game won
            cell_selection.setAttribute('selected', 'false')
            cell_selection = null
            gameover = true

            // set status message
            UI.message.textContent = UI.messages.won.replace('%i', selection.y + 1)
            UI.message.className = 'won'
        } else if (selection.y == guesses - 1) {
            // game lost
            cell_selection.setAttribute('selected', 'false')
            cell_selection = null
            gameover = true

            // set status message
            UI.message.textContent = UI.messages.lost.replace('%s', word)
            UI.message.className = 'lost'
        } else {
            // move to next row
            UI.cells[selection.y].forEach(cell => cell.setAttribute('enabled', 'false'))
            UI.cells[selection.y + 1].forEach(cell => cell.setAttribute('enabled', 'true'))
            cell_selection = UI.cells[selection.y + 1][0]
            cell_selection.setAttribute('selected', 'true')
        }

        // highlight previous row
        // copy of the word to keep track of letters that have been flagged
        // consider following scenario: word = "monkey", guess = "doodle"
        // the first letter o is valid, the second shouldn't be flagged as "wrong position"
        // since the o only appears once.
        // this trackkeeping helps with that, as every "taken" letter gets replaced by a "-" 
        let word_checklist = word

        // first pass, mark all as invalid
        UI.cells[selection.y].forEach(cell => {
            if (!cell.getAttribute('value')) cell.setAttribute('value', 0)
        })

        // second pass, mark correct letters
        for (let i = 0; i < word.length; i++) {
            let char_original = word_checklist.charAt(i)
            let char_guess = guess.charAt(i)

            if (char_guess == char_original) {
                // char is correct
                UI.cells[selection.y][i].setAttribute('value', '2')

                // flag char in word_checklist as taken (replace with -)
                let index = word_checklist.split('').findIndex(char => char === char_guess)
                word_checklist = word_checklist.split('')
                word_checklist[index] = '-'
                word_checklist = word_checklist.join('')

                // flag char in guess as checked
                guess = guess.split('')
                guess[i] = '-'
                guess = guess.join('')
            }
        }

        // third pass, highlight all non-included
        for (let i = 0; i < word.length; i++) {
            let char_guess = guess.charAt(i)

            // if char left in word and char not already checked
            if (word_checklist.includes(char_guess) && char_guess != '-') {
                // char in word, wrong position
                UI.cells[selection.y][i].setAttribute('value', '1')

                // flag char in word_checklist as taken (replace with -)
                let index = [...word_checklist].findIndex(char => char === char_guess)
                word_checklist = [...word_checklist]
                word_checklist[index] = '-'
                word_checklist = word_checklist.join('')
            }
        }
    } else {
        // show missing chars error
        UI.cells[selection.y].filter(cell => cell.textContent === '').forEach(cell => {
            cell.classList.add('error')
            setTimeout(() => cell.classList.remove('error'), 500)
        })
    }
}

// get string from row
function get_text(y) {
    return UI.cells[y].reduce((a, b) => a + b.textContent, '')
}

// return a random element from an array
Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)]
}

// return a random word from the wordlist
function random_word() {
    return Object.values(wordlist).random().random()
}

// reset button
document.querySelector('#reset').addEventListener('click', () => reset())

// start
setup()