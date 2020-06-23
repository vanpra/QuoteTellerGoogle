import {dialogflow, Image, DialogflowConversation} from 'actions-on-google';
import {Suggestions, BasicCard, SimpleResponse}
  from 'actions-on-google/dist/service/actionssdk';
import { SSML, Rate } from './ssml';
import * as firebase from 'firebase';
import express from 'express';
import bodyParser from 'body-parser';

const app = dialogflow();
const PORT = process.env.PORT || 5001;

const config = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
};

firebase.initializeApp(config);
const database = firebase.database();

const suggestions = ['Famous', 'Inspirational', 'Book'];
const anotherQuote = 'Would you like to hear another quote?';
const reprompt = "Sorry, I didn't understand that. You can ask for a famous \
quote, an inspirational quote or a book quote";

/**
 * Capitilises the first letter of a string
 *
 * @param {string} str  the input string
 * @return {string} input string with capitalised first letter
*/
function capitaliseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Retrives a quote from the firebase db
 * @param {string} quoteType type of quote to retrive
 * @return {Promise<string | Array<string>>} Returns the quote or an array with
 * the quote and an image
 */
async function getQuote(quoteType: string): Promise<string | Array<string>> {
  const dbPath = '/' + quoteType;
  return database.ref(dbPath).once('value').then((data) => {
    const quotes: Array<string> = data.val();
    const randomIndex = (Math.random() * (quotes.length - 1)).toFixed();
    return (quotes[randomIndex]);
  });
}

/**
 * Retrives and returns a quote of a given type to the user
 * @param { DialogflowConversation } conv the current dialogflow conversation
 * @param { string } quoteType the type of quote to return to the user
 */
function sendQuote(conv: DialogflowConversation, quoteType: string) {
  return getQuote(quoteType).then((quote: string | Array<string>) => {
    // const quoteText = new SSML();

    if (quote instanceof Array) {
      if (conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
        conv.ask(new SimpleResponse({
          text: "Here's a quote for you:",
          speech: quote[0]
        }));
        conv.ask(new BasicCard({
          title: capitaliseFirstLetter(quoteType) + ' Quote',
          text: quote[0],
          image: new Image({
            url: quote[1],
            alt: capitaliseFirstLetter(quoteType)  + ' Quote',
          }),
        }));
        conv.ask(new Suggestions(suggestions));
      } else{
        conv.ask(quote[0] + '.');
      }
    } else {
      conv.ask(quote);
      if (conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
        conv.ask(new Suggestions(suggestions));
      }
    }
    conv.ask(anotherQuote);
  });
}

app.intent('WelcomeIntent', (conv) => {
  // const resFancy = `I have a variety of different quotes so if you would like
  //    to hear one just ask me for one`;
  // const res =
  //    `I can tell you a variety of different quotes such as Famous, Boook, 
  //    Inspirational or Google quotes, so if you would like hear one just ask 
  //    me for one`;

  const welcome = new SSML();
  welcome.speak(`Welcome to quote teller. I have a variety of different quotes \
  for you to choose from. If you'd like to hear one just say, "tell me `);
  welcome.prosody("a", Rate.MEDIUM);
  welcome.break("300ms");
  welcome.speak(`", followed by the type of quote you'd like to hear.`);
  
  if (conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {
    conv.ask(new Suggestions(suggestions));
  } else {
    welcome.speak("I can tell you a book quote, a famous quote, an \
    inspirational quote or even the quote of the day.")
  }
  conv.ask(welcome.toString());
});

app.intent('tellQuote', async (conv, {quoteType}) => {
  if (!(typeof quoteType === 'string')) {
    conv.ask(reprompt);
    return;
  }

  await sendQuote(conv, quoteType);
});

app.intent('quote_yes', async (conv, {quoteType}) => {
  if (!(typeof quoteType === 'string')) {
    conv.ask(reprompt);
    return;
  }
  await sendQuote(conv, quoteType);
});

app.intent('Default Fallback Intent', (conv) => {
  conv.ask(reprompt);
});

app.fallback((conv) => {
  conv.ask(reprompt)
})

express().use(bodyParser.json(), app).listen(PORT);


