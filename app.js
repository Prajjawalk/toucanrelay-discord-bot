import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions';
import { DiscordRequest, VerifyDiscordRequest, getRandomEmoji } from './utils.js';
import timeout from 'connect-timeout';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));
/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }

    if (name === 'send' && id) {
      const userId = req.body.member.user.id;
      const inputValues = req.body.data.options;
      const ipfsHash = inputValues[0].value
      const receiverAddress = inputValues[1].value
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}`

      res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Received relay request from <@${userId}>`
        }
      })
      
      try {
      const resp = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`, {
        "method": "GET",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
      })
  
      const proofData = await resp.json();
      proofData["receiverAddress"] = receiverAddress;
      console.log(proofData)

      const txResp = await fetch(`${TOUCAN_RELAY_SERVER}/api/discordbot`, {
        "method": "POST",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
        body: JSON.stringify(proofData)
      })

      const txData = await txResp.json()
      console.log(txData.transaction)

      await DiscordRequest(endpoint, {
        method: 'POST',
        body: {
          content: `Relayed transaction for <@${userId}>! Tx Hash = ${txData.transaction}`
        },
      })
    } catch(e) {
      console.log(e)
      await DiscordRequest(endpoint, {
        method: 'POST',
        body: {
          content: `Failed to relay transaction for <@${userId}>! Please check inputs or contact support.`
        },
      })
    }
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});