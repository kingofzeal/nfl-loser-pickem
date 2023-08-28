const { App } = require('@slack/bolt');
const axios = require('axios');
require('dotenv').config();
const sql = require('mssql');

var sqlConfig = {
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  server: process.env.SQL_HOST,
  pool: {
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true
  }
};

var sqlClient;

// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

app.message('hello', async ({message, say}) => {
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `Hey <@${message.user}>`
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Click Me"
          },
          "action_id": "button_click"
        }
      }
    ],
    text: `Hey <@${message.user}>`
  });
});

async function getCurrentSelection(userId){
  const response = await sqlClient.request()
    .input('playerId', sql.NVarChar(100), userId)
    .query(`SELECT t.Id
    ,t.Name
    ,t.Abbreviation
  FROM Teams t
  LEFT OUTER JOIN Games g ON g.Team1 = t.Id or g.Team2 = t.Id
  LEFT OUTER JOIN PlayerTeams pt ON pt.TeamId = t.Id and pt.Week = g.Week
  LEFT OUTER JOIN Players p ON p.Id = pt.PlayerId
  LEFT OUTER JOIN Config c ON c.CurrentWeek = g.Week
  WHERE c.Id = 1
    and p.SlackId = @playerId`);

  return response.recordset[0]
}

async function displaySelectionModal(triggerId, userId, client) {
  const current = await getCurrentSelection(userId);
  console.log(current);

  const view = await client.views.open({
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: 'nfl_team_picked',
      title: {
        type: "plain_text",
        text: "NFL Loser Pick'em"
      },
      close:{
        type: "plain_text",
        text: "Close"
      },
      blocks: [
        {
          type: "section",
          text: {
            "type": "mrkdwn",
            "text": "Loading NFL data..."
          }
        }
      ],      
    },    
  });


  const ps = new sql.PreparedStatement();
  ps.input('playerId', sql.NVarChar(100));

  ps.prepare(`;WITH weekTeams AS (
    SELECT t.Id
  		,t.Name
		  ,t.Abbreviation
	  FROM Teams t
	  LEFT OUTER JOIN Games g ON g.Team1 = t.Id or g.Team2 = t.Id
	  LEFT OUTER JOIN Config c ON c.CurrentWeek = g.Week
	  WHERE g.Id IS NOT NULL
		  and c.Id = 1
  ), playerSelection AS (
    SELECT pt.*
    FROM PlayerTeams pt
    LEFT OUTER JOIN Players p ON pt.PlayerId = p.Id
    LEFT OUTER JOIN Config c on c.CurrentWeek = pt.Week
    WHERE p.SlackId = @playerId 
      and c.Id = 1
  )
  
  SELECT t.* 
  FROM weekTeams t
  LEFT OUTER JOIN playerSelection ps ON t.Id = ps.TeamId
  WHERE ps.PlayerId IS NULL
  ORDER BY t.Abbreviation ASC`, err => {
    ps.execute({playerId: userId}, async (err, result) => {
      const selections = [];

      for (const team of result.recordset){
        selections.push({
          text: {
            type: "plain_text",
            text: `${team.Name} (${team.Abbreviation})`
          },
          value: `${team.Id}`
        });
      }

      await client.views.update({
        view_id: view.view.id,
        view: {
          type: "modal",
          callback_id: 'nfl_team_picked',
          title: {
            type: "plain_text",
            text: "NFL Loser Pick'em"
          },
          close:{
            type: "plain_text",
            text: "Close"
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Current Selection: ${current.Name} (${current.Abbreviation})`
              }
            },
            {
              block_id: 'team_select',
              type: "section",
              text: {
                "type": "mrkdwn",
                "text": "Select your team"
              },
              accessory: {
                action_id: "team_selection",
                type: "static_select",
                placeholder: {
                  type: "plain_text",
                  text: "Choose"
                },
                focus_on_load: true,            
                options: selections
              }        
            }
          ],
          submit: {
            type: "plain_text",
            text: "Submit"
          }
        }
      });
      ps.unprepare(err => {});
    });
  });
}

app.view('nfl_team_picked', async ({ack, body, view, client, logger}) => {
  console.log(view);

  const selectedOption = view.state.values.team_select.team_selection.selected_option;

  if (!selectedOption){
    return;
  }

  await updateUserSelection(ack, body.user.id, selectedOption);
});

async function updateUserSelection(ack, userId, selection) {
  console.log(selection);

  const request = new sql.Request();
  request.input('UserSlackId', sql.NVarChar(), userId);
  request.input('TeamId', sql.Int, +selection.value);

  request.execute('usp_RecordUserSelection', async (err, result) => {
    if (err){
      console.log(err);
    } else{
      await ack({
        response_action: 'update',
        view: {
          type: "modal",
          callback_id: 'nfl_team_picked',
          title: {
            type: "plain_text",
            text: "NFL Loser Pick'em"
          },
          close:{
            type: "plain_text",
            text: "Close"
          },
          blocks: [
            {
              type: "section",
              text: {
                "type": "mrkdwn",
                "text": `Sucessfully picked *${selection.text.text}*`
              }
            }
          ],      
        }
      })
    }
  })
}

app.command('/nfl', async ({ack, body, client, logger}) => {
  await ack();

  console.log(body.user_id);
  await displaySelectionModal(body.trigger_id, body.user_id, client);
});

app.action('button_click', async ({ack, body, client, logger}) => {
  await ack();

  await displaySelectionModal(body.trigger_id, body.user.id, client);
});

(async () => {
  
  sqlClient = await sql.connect(sqlConfig);
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();