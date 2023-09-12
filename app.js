const { App } = require('@slack/bolt');
const axios = require('axios');
const cron = require('node-cron');
const sql = require('mssql');
const canvasTable = require('canvas-table');
const cnvs = require('canvas');
require('dotenv').config();

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

//#region TESTING ENTRY POINTS
app.action('button_scores', async ({ack, body, client}) => {
  await ack();
  
  await checkScores();
});

app.action('button_results', async ({ack, body, client}) => {
  await ack();
  
  await checkResults();
});

app.action('button_reminder', async ({ack, body, client}) => {
  await ack();
  
  await postReminder();
});
//#endregion

async function getCurrentSelection(slackTeamId, userId){
  const response = await sqlClient.request()
    .input('playerId', sql.NVarChar(sql.MAX), userId)
    .input('slackTeamId', sql.NVarChar(sql.MAX), slackTeamId)
    .query(`SELECT t.Id
    ,t.Name
    ,t.Abbreviation
    ,CASE
      WHEN g.GameTime < CURRENT_TIMESTAMP THEN 1
      ELSE 0
    END AS 'GameStarted'
    ,c.SlackReportChannelId
  FROM Teams t
  LEFT OUTER JOIN Games g ON g.Team1 = t.Id or g.Team2 = t.Id
  LEFT OUTER JOIN PlayerTeams pt ON pt.TeamId = t.Id and pt.Week = g.Week
  LEFT OUTER JOIN Players p ON p.Id = pt.PlayerId
  LEFT OUTER JOIN Config c ON c.CurrentWeek = g.Week
  WHERE c.SlackTeamId = @slackTeamId
    and p.SlackId = @playerId
    and p.SlackTeamId = @slackTeamId`);

  return response.recordset[0]
}

async function displaySelectionModal(triggerId, slackTeamId, userId, client) {
  const current = await getCurrentSelection(slackTeamId, userId);
  // console.log(current);

  if (current.GameStarted){
    await client.views.open({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'NFL Loser Pick\'em'
        },
        close:{
          type: 'plain_text',
          text: 'Close'
        },
        blocks: [
          {
            type: 'section',
            text: {
              'type': 'mrkdwn',
              'text': `You have selected *${current.Name} (${current.Abbreviation})*

This game has already started, so you cannot change your selection.
When all games have completed, the results will be posted in <#${current.SlackReportChannelId}>.

*Good Luck*`
            }
          }
        ],      
      },    
    });

    return;
  }

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

  const result = await sqlClient.request()
    .input('playerId', sql.NVarChar(sql.MAX), userId)
    .input('slackTeamId', sql.NVarChar(sql.MAX), slackTeamId)
    .query(`;WITH weekTeams AS (
      SELECT t.Id
        ,t.Name
        ,t.Abbreviation
      FROM Teams t
      LEFT OUTER JOIN Games g ON g.Team1 = t.Id or g.Team2 = t.Id
      LEFT OUTER JOIN Config c ON c.CurrentWeek = g.Week
      WHERE g.Id IS NOT NULL
        and g.GameTime > CURRENT_TIMESTAMP
        and c.SlackTeamId = @slackTeamId
    ), playerSelection AS (
      SELECT pt.*
      FROM PlayerTeams pt
      LEFT OUTER JOIN Players p ON pt.PlayerId = p.Id
      WHERE p.SlackId = @playerId
        and p.SlackTeamId = @slackTeamId
    )
    
    SELECT t.* 
    FROM weekTeams t
    LEFT OUTER JOIN playerSelection ps ON t.Id = ps.TeamId
    WHERE ps.PlayerId IS NULL
    ORDER BY t.Abbreviation ASC`);
    
  const selections = [];
  let currentObj = {};

  if (current){
    currentObj = {
      text: {
        type: "plain_text",
        text: `${current.Name} (${current.Abbreviation})`
      },
      value: `${current.Id}`
    };
    selections.push(currentObj);
  }

  for (const team of result.recordset){
    selections.push({
      text: {
        type: "plain_text",
        text: `${team.Name} (${team.Abbreviation})`
      },
      value: `${team.Id}`
    });
  }

  const payload = {
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
      blocks: [],
      submit: {
        type: "plain_text",
        text: "Submit"
      }
    }
  };

  if (current){
    payload.view.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Current Selection: *${current.Name} (${current.Abbreviation})*`
      }
    });
  }

  const selection = {
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
  };

  if (current){
    selection.accessory.initial_option = currentObj;
  }

  payload.view.blocks.push(selection);

  await client.views.update(payload);
}

async function updateUserSelection(ack, slackTeamId, userId, selection) {
  // console.log(selection);

  const response = await sqlClient.request()
    .input('UserSlackId', sql.NVarChar(sql.MAX), userId)
    .input('UserSlackTeamId', sql.NVarChar(sql.MAX), slackTeamId)
    .input('TeamId', sql.Int, +selection.value)
    .execute('usp_RecordUserSelection');
    
  // console.log(response);

  if (response.returnValue !== 0){
    console.log(response.output);
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
}

async function initializeGame(triggerId, client){
  const year = new Date().getFullYear();
  const numWeeks = 18;

  const view = await client.views.open({
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: 'init_parameters',
      title: {
        type: "plain_text",
        text: "NFL Loser Pick'em Setup"
      },
      close:{
        type: "plain_text",
        text: "Close"
      },
      blocks: [
        {
          type: 'input',
          block_id: 'season',
          element: {
            type: "number_input",
            is_decimal_allowed: false,
            action_id: 'season',
            initial_value: `${year}`
          },
          label: {
            type: 'plain_text',
            text: 'Year/Season'
          }
        },
        {
          type: 'input',
          block_id: 'numWeeks',
          element: {
            type: "number_input",
            is_decimal_allowed: false,
            action_id: 'numWeeks',
            initial_value: `${numWeeks}`
          },
          label:{
            type: 'plain_text',
            text: 'Number of Weeks'
          }
        },        
        {
          type: 'section',
          block_id: 'channel_selection',
          text:{
            type: 'plain_text',
            text: 'Channel to post public message to'
          },
          accessory: {
            action_id: 'channel_selection',
            type: 'channels_select',
          },
        },
        {
          type: 'section',
          text:{
            type: 'mrkdwn',
            text: '*WARNING: THIS WILL DESTROY ALL CURRENT DATA AND RESET FOR THE SELECTED SEASON*'
          }
        }
      ],
      submit: {
        type: "plain_text",
        text: "Submit"
      }   
    },    
  });
};

async function checkResults(){
  console.log('Generating results');

  //Set player results based on scores
  await sqlClient.request()
    .query(`UPDATE pt
    SET pt.Result = CASE
      WHEN pt.TeamId = g.Team1 and g.Team1Score < g.Team2Score THEN 1
      WHEN pt.TeamId = g.Team2 and g.Team2Score < g.Team1Score THEN 1
      ELSE 0
    END
    FROM PlayerTeams pt
    LEFT OUTER JOIN Games g ON (g.Team1 = pt.TeamId or g.Team2 = pt.TeamId) and g.Week = pt.Week
    WHERE g.Team1Score IS NOT NULL and
      g.Team2Score IS NOT NULL and
      pt.Result IS NULL`);

  const remainingGames = await sqlClient.request()
    .query(`SELECT
      c.SlackTeamId
      ,c.CurrentWeek
      ,c.SlackReportChannelId
      ,COUNT(pt.PlayerId) as 'PlayersRemaining'
      ,COUNT(pt2.PlayerId) as 'TotalPlayers'
    FROM Config c
    INNER JOIN Players p on p.SlackTeamId = c.SlackTeamId
    LEFT OUTER JOIN PlayerTeams pt ON pt.PlayerId = p.Id and pt.Week = c.CurrentWeek and pt.Result IS NULL
    LEFT OUTER JOIN PlayerTeams pt2 ON pt2.PlayerId = p.Id and pt2.Week = c.CurrentWeek
    GROUP BY c.SlackTeamId, c.CurrentWeek, c.SlackReportChannelId`);

  for (const slackTeam of remainingGames.recordset){
    if (slackTeam.TotalPlayers == 0 || slackTeam.Count > 0){
      //Still has outstanding games
      continue;
    }

    const playerQuery = await sqlClient.request()
      .input('slackTeam', sql.NVarChar(sql.MAX), slackTeam.SlackTeamId)
      .query(`SELECT
        p.Name
        ,p.SlackId
        ,pt.Week
        ,t.Abbreviation
        ,pt.Result
      FROM Players p
      LEFT OUTER JOIN PlayerTeams pt ON pt.PlayerId = p.Id
      LEFT OUTER JOIN Teams t ON t.Id = pt.TeamId
      WHERE p.SlackTeamId = @slackTeam`);

    const numPlayers = [...new Set(playerQuery.recordset.map(x => x.Name))].length

    const imgWidth = (85 + ((slackTeam.CurrentWeek + 1) * 60)) + 10; //75 Name, 55 Record, 55/week
    const imgHeight = (25 * (numPlayers + 1)) + 10;

    const canvas = cnvs.createCanvas(imgWidth, imgHeight);
    const config = {
      columns: [
        { 
          title: '', 
          options: { 
            minWidth: 75
          } 
        },
        { 
          title: 'Record', 
          options: { 
            minWidth: 50,
            textAlign: 'center' 
          } 
        },
      ],
      data: [],
      options: {
        borders: {
          header: {
            color: '#000000',
            width: 1
          },
          column: {
            color: '#000000',
            width: 1
          },
          row: {
            color: '#000000',
            width: 1
          },
          table: {
            color: '#000000',
            width: 1
          }
        },
        padding: {
          bottom: 5,
          top: 5,
          left: 5,
          right: 5
        },
        devicePixelRatio: 2
      }
    }

    for (let week = 1; week <= slackTeam.CurrentWeek; week++){
      config.columns.push({ 
        title: `Week ${week}`, 
        options: { 
          minWidth: 50,
          textAlign: 'center'
        }
      });
    }

    const players = [];

    for (const record of playerQuery.recordset){
      let player = players.filter(x => x.name == record.Name)[0];

      if (!player){
        player = {
          name: record.Name,
          wins: 0,
          losses: 0
        };

        players.push(player);
      }

      if (record.Result == 1){
        player.wins++;
      } else{
        player.losses++;
      }
    }

    players.sort((a, b) => {
      if (a.wins < b.wins) return 1;
      if (a.wins > b.wins) return -1;
      if (a.losses < b.losses) return -1;
      if (a.losses > b.losses) return 1;

      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;

      return 0;
    })

    for (const player of players){
      const tableRecord = [player.name]
      tableRecord.push({
        value: `${player.wins}-${player.losses}`,
        textAlign: 'center'
      });

      for (let week = 1; week <= slackTeam.CurrentWeek; week++){
        const playerGame = playerQuery.recordset.filter(x => x.Name == player.name && x.Week == week)[0];
        tableRecord.push({
          value: playerGame.Abbreviation,
          background: playerGame.Result ? '#339933' : '#cc3300',
          textAlign: 'center'
        });
      }

      config.data.push(tableRecord);
    }
 
    const ct = new canvasTable.CanvasTable(canvas, config);
    await ct.generateTable();    
    await ct.renderToFile(`${slackTeam.SlackTeamId}.png`);

    app.client.filesUploadV2({
      initial_comment: `Results for week ${slackTeam.CurrentWeek} are in!`,
      // title: `Results for week ${slackTeam.CurrentWeek}`,
      file: `${slackTeam.SlackTeamId}.png`,
      filename: `${slackTeam.SlackTeamId} ${new Date().toISOString()}.png`,
      channel_id: slackTeam.SlackReportChannelId
    });

    await sqlClient.request()
      .input('slackTeam', sql.NVarChar(sql.MAX), slackTeam.SlackTeamId)
      .query(`UPDATE Config SET CurrentWeek = CurrentWeek + 1 WHERE SlackTeamId = @slackTeam`);
  }
};

async function checkScores(){
  console.log('Beginning score check');
  var pendingWeeks = await sqlClient.request()
    .query(`SELECT DISTINCT
      g.Week
      ,g.Season
    FROM Games g
    INNER JOIN (SELECT DISTINCT CurrentWeek FROM Config) c ON c.CurrentWeek = g.Week
    WHERE g.Team1Score IS NULL OR g.Team2Score IS NULL`)

  var pendingGames = await sqlClient.request()
    .query(`SELECT
      g.Id
      ,g.Week
      ,g.Season
      ,g.GameTime
      ,g.Team1Score
      ,g.Team2Score
      ,t1.Abbreviation as 'Team1Abbreviation'
      ,t1.Name as 'Team1Name'
      ,t2.Abbreviation as 'Team2Abbreviation'
      ,t2.Name as 'Team2Name'
    FROM Games g
    LEFT JOIN Teams t1 ON t1.Id = g.Team1
    LEFT JOIN Teams t2 ON t2.Id = g.Team2
    INNER JOIN (SELECT DISTINCT CurrentWeek FROM Config) c ON c.CurrentWeek = g.Week
    WHERE g.Team1Score IS NULL or g.Team2Score IS NULL
    ORDER BY g.GameTime ASC`);

  for (const week of pendingWeeks.recordset){
    const weekData = await axios.get(`https://cdn.espn.com/core/nfl/schedule?xhr=1&year=${week.Season}&week=${week.Week}`);

    for (const date in weekData.data.content.schedule){
      const gameDate = weekData.data.content.schedule[date];

      for (const game of gameDate.games){
        const details = game.competitions[0];

        
        if (!details || !details.status || !details.status.type) {
          console.log(`Could not parse schedule details`);
          continue;
        }

        if (!details.status.type.completed){
          console.log(`Game ${details.competitors[0].team.abbreviation} vs ${details.competitors[1].team.abbreviation}: Not yet completed.`)
          continue;
        }

        for (const team of details.competitors){
          const queryGame = pendingGames.recordset.filter(x => x.Team1Abbreviation === team.team.abbreviation ||
            x.Team2Abbreviation === team.team.abbreviation)[0];

          if (!queryGame){
            continue;
          }

          let field = '';

          if (queryGame.Team1Abbreviation === team.team.abbreviation){
            field = 'Team1Score';
          } else if (queryGame.Team2Abbreviation === team.team.abbreviation){
            field = 'Team2Score';
          }

          if (!field) {
            continue;
          }
          
          await sqlClient.request()
            .input('gameId', sql.Int, queryGame.Id)
            .input('teamScore', sql.Int, +team.score)
            .query(`UPDATE Games SET ${field} = @teamScore WHERE Id = @gameId`);

          console.log(`Game ${queryGame.Team1Abbreviation} vs ${queryGame.Team2Abbreviation}: ${team.team.abbreviation} with ${team.score}`);
        }
      }
    }
  }
};

async function postReminder(){
  const players = await sqlClient.request()
    .query(`SELECT p.Name
      ,p.SlackId
      ,p.SlackTeamId
      ,c.SlackReportChannelId
    FROM Players p
    LEFT OUTER JOIN Config c ON p.SlackTeamId = c.SlackTeamId
    LEFT OUTER JOIN PlayerTeams pt ON pt.PlayerId = p.Id and pt.Week = c.CurrentWeek
    WHERE pt.PlayerId IS NULL`);

  const message = 'Reminder that you have not yet chosen your team for the NFL Loser Pick\'em.';

  for (const player of players.recordset){
    await app.client.chat.postMessage({
      channel: player.SlackId,
      text: message,
      blocks:[
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: message
          },
          accessory: {
            action_id: 'button_nfl',
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Select Team'
            }
          }
        }
      ]
    });
  }  
};

//#region APP ENTRY POINTS
app.view('nfl_team_picked', async ({ack, body, view}) => {
  // console.log(view);

  const selectedOption = view.state.values.team_select.team_selection.selected_option;

  if (!selectedOption){
    return;
  }

  var current = await getCurrentSelection(body.team.id, body.user.id);
  // console.log({selectedOption, current});
  
  if (current && current.Id == selectedOption.value){
    await ack();
    return;
  }

  await updateUserSelection(ack, body.team.id, body.user.id, selectedOption);
});

app.view('init_parameters', async ({ack, body, view}) => {
  // console.log(view.state.values);
  await ack();

  const selectedYear = +view.state.values.season.season.value;
  let selectedGames = +view.state.values.numWeeks.numWeeks.value;
  let selectedChannel = view.state.values.channel_selection.channel_selection.selected_channel;

  let knownTeams = {};

  const purgeResult = await sqlClient.request()
    .input('teamId', sql.NVarChar(sql.MAX), body.team.id)
    .input('channelId', sql.NVarChar(sql.MAX), selectedChannel)
    .input('season', sql.Int, selectedYear)
    .query(`TRUNCATE TABLE PlayerTeams;
      TRUNCATE TABLE Games;
      UPDATE Config SET CurrentWeek = 1, Season = @season, SlackReportChannelId = @channelId WHERE SlackTeamId = @teamId;`);

  console.log('Game data and player selections purged.');

  for(let weekNum = 1; weekNum <= selectedGames; weekNum++)
  {
    console.log(`Week ${weekNum}...`)
    const weekData = await axios.get(`https://cdn.espn.com/core/nfl/schedule?xhr=1&year=${selectedYear}&week=${weekNum}`);

    for(const date in weekData.data.content.schedule){
      const gameDate = weekData.data.content.schedule[date];
      for(const game of gameDate.games){
        const details = game.competitions[0];
        
        for (const team of details.competitors){
          if (!knownTeams[team.team.abbreviation]){
            const teamLookup = await sqlClient.request()
              .input('teamAbbrev', sql.NVarChar(10), team.team.abbreviation)
              .input('teamName', sql.NVarChar(sql.MAX), team.team.displayName)
              .query(`SELECT t.Id
                ,t.Name
                ,t.Abbreviation
              FROM Teams t
              WHERE t.Abbreviation = @teamAbbrev 
                and t.Name = @teamName`);

            if (teamLookup.recordset.length > 0){
              const foundTeam = teamLookup.recordset[0];
              knownTeams[foundTeam.Abbreviation] = foundTeam;
            } else {
              //Insert team into DB
            }
          }
        }
        //console.log(details);
        //return;

        console.log(`   ${details.competitors[0].team.abbreviation} vs ${details.competitors[1].team.abbreviation}`);
        await sqlClient.request()
          .input('team1Id', sql.Int, knownTeams[details.competitors[0].team.abbreviation].Id)
          .input('team2Id', sql.Int, knownTeams[details.competitors[1].team.abbreviation].Id)
          .input('week', sql.Int, weekNum)
          .input('season', sql.Int, selectedYear)
          .input('gameTime', sql.DateTimeOffset, details.date)
          .query(`INSERT INTO Games (Week, Season, Team1, Team2, GameTime)
            VALUES (@week, @season, @team1Id, @team2Id, @gameTime)`);

        //console.log(gameInsertResult);

        // return;
      }
    }
  }

  // https://cdn.espn.com/core/nfl/schedule?xhr=1&year={year}&week={week}

  console.log(`Database reseeded for ${selectedGames} weeks of the ${selectedYear} season.`);
});

app.command('/nfl', async ({ack, body, client, command}) => {
  await ack();

  if (command.text.startsWith('init ') && command.text.substring(5) == process.env.RESET_PASSWORD){
    await initializeGame(body.trigger_id, client);
    return;
  }

  // console.log(body);
  await displaySelectionModal(body.trigger_id, body.team_id, body.user_id, client);
});

app.action('button_nfl', async ({ack, body, client}) => {
  await ack();
  
  await displaySelectionModal(body.trigger_id, body.team.id, body.user.id, client);
});

app.action('team_selection', async ({ack}) => {
  await ack();
});

app.action('channel_selection', async ({ack}) => {
  await ack();
});
//#endregion

(async () => {
  sqlClient = await sql.connect(sqlConfig);
  // Start your app
  await app.start(process.env.PORT || 3000);

  /* Scheduled Tasks */
  cron.schedule('0 0 * * FRI,SAT,SUN,MON,TUE', () => checkScores(), { timezone: 'America/Chicago' }); //All games are Thurs-Mon
  cron.schedule('0 8 * * TUE', () => checkResults(), { timezone: 'America/Chicago' });
  cron.schedule('0 14 * * FRI', () => postReminder(), { timezone: 'America/Chicago' });

 
  if (!true){
    await app.client.chat.postMessage({
      channel: 'C2F7PQBJT',
      blocks: [
        {
          type: "actions",
          block_id: 'dev_shortcut',
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "/nfl"
              },
              action_id: "button_nfl"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Check Scores"
              },
              action_id: "button_scores"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Check Results"
              },
              action_id: "button_results"
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Post Reminder"
              },
              action_id: "button_reminder"
            }
          ]
        }
      ]
    });
  }
  console.log('⚡️ Bolt app is running!');
  // checkResults();
})();