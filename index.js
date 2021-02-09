///////////////////////////////////////////////////////////////
//             THIS CODE HAVE BEEN CREATED BY                //
//           BurnGemios3643 alias patatoe02#1499             //
//    PLEASE MENTION THE AUTHOR AND DO NOT REMOVE CREDITS    //
///////////////////////////////////////////////////////////////

//Vercode: 0.1

process.setMaxListeners(0);

const Discord = require("discord.js");
const fs = require("fs");
const db = require('mysql2-promise')();

const commandes = [];

let config = {
    "token":"DiscordBotToken",
    "base":{
        "host":"localhost",
        "port":3306,
        "user":"user",
        "pass":"password",
        "base":"base"
    },
    "superuser": "DiscordSuperUserId"
};

readConfigs();

db.configure({
    host: config.base.host,
    port: config.base.port,
    user: config.base.user,
    password: config.base.pass,
    database : config.base.base
});

const client = new Discord.Client();

function readConfigs(){
    if(!fs.existsSync('config.json')) {
        fs.writeFileSync('config.json', JSON.stringify(config));
        console.log("######################################"+
                    "config file created, please configure!"+
                    "######################################")
        process.exit(1);
    }
    var contents = fs.readFileSync("config.json");
    config = JSON.parse(contents);
    console.log('Config parsed!');
}

client.on('ready', () => {
    console.log('Discord Bot connected!');
    addNewEveryoneToEveryone();
    registerCommand(`help`, null, null, help);
    registerCommand(`addbot`, [`[0-9]{18}`], null, addbot);
    registerCommand(`rembot`, [`[0-9]{18}`], null, rembot);
    registerCommand(`report`, [`[0-9]{18}`, `.+`], null, report);
    registerCommand(`botinvite`, [`[0-9]{18}`], null, botinvite);
    registerCommand(`botleave`, [`[0-9]{18}`], null, botleave);
    registerCommand(`setrequests`, null, [`ADMINISTRATOR`], setrequests);
    registerCommand(`setreports`, null, [`ADMINISTRATOR`], setreports);
    registerCommand(`banbots`, [`[0-9]{18}`], [`KICK_MEMBERS`], banbots);
    registerCommand(`ban`, [`[0-9]{18}`], [`BAN_MEMBERS`], ban);
});

client.on('guildCreate', async guild => {
    newEveryone(guild);
    db.query(`INSERT INTO servers (id) VALUES (?) ON DUPLICATE KEY UPDATE id = id;`, [guild.id]);
});

async function newEveryone(guild){
    if(!guild.roles.cache.find(role => role.name === 'NewEveryone')){
        const ne = await guild.roles.create({data:{name: 'NewEveryone', permsions: guild.roles.everyone.permissions, reason: 'use NewEveryone instead of everyone to protect users from dm spamming'}});
        guild.roles.everyone.setPermissions(0, {reason: 'use NewEveryone instead of everyone to protect users from dm spamming'});
        if(ne) guild.members.cache.each(member => {
            member.roles.add(ne);
        });
    }
    let role;
    if(guild.me.hasPermission('ADMINISTRATOR') && (role = guild.roles.cache.find(role => role.name === 'NewEveryone'))){
        return role;
    }
    return null;
}

function addNewEveryoneToEveryone(){
    client.guilds.cache.each(async guild => {
        const ne = await newEveryone(guild);
        if(ne) guild.members.cache.each(member => {
            if(!member.user.bot)member.roles.add(ne);
        });
    });
}

client.on('guildMemberAdd', async newMember => {
    const guild = newMember.guild;
    const ne = await newEveryone(guild);
    if(!newMember.user.bot){
        if(ne) newMember.roles.add(ne);
        return;
    }
    const request = (await db.query(`SELECT * FROM requests WHERE server_id = ? AND bot_id = ?`, [guild.id, newMember.user.id]))[0];
    if(request.length > 0){
        db.query(`DELETE FROM requests WHERE server_id = ? AND bot_id = ?`, [guild.id, newMember.user.id]);
        if(request[0].cancelled){
            newMember.kick();
            return;
        }

        let category = await guild.channels.create(newMember.user.username.replace(/\W/g, ''), {type: 'category', reason: `bot category for ${newMember.id}` });
        let perms = [
                {
                    id: guild.id,
                    deny: ['VIEW_CHANNEL']
                },
                {
                    id: request[0].user_id,
                    allow: ['VIEW_CHANNEL', 'USE_VAD', 'MOVE_MEMBERS', 'DEAFEN_MEMBERS', 'MUTE_MEMBERS', 'SPEAK', 'CONNECT', 'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES', 'EMBED_LINKS', 'MANAGE_MESSAGES', 'SEND_MESSAGES', 'STREAM', 'PRIORITY_SPEAKER', 'ADD_REACTIONS']
                },
                {
                    id: newMember.user.id,
                    allow: ['VIEW_CHANNEL', 'USE_VAD', 'MOVE_MEMBERS', 'DEAFEN_MEMBERS', 'MUTE_MEMBERS', 'SPEAK', 'CONNECT', 'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES', 'EMBED_LINKS', 'MANAGE_MESSAGES', 'SEND_MESSAGES', 'STREAM', 'PRIORITY_SPEAKER', 'ADD_REACTIONS']
                }
            ];
        if(ne) perms.push({id: ne.id, deny: ['VIEW_CHANNEL']});
        category.overwritePermissions(perms);
        let txt = await guild.channels.create("text", {type: 'text', reason: `bot text channel for ${newMember.id}`}); 
        txt = await txt.setParent(`${category.id}`);
        txt.lockPermissions();
        db.query(`INSERT INTO bots (bot_id, user_id, server_id, category_id) VALUES (?, ?, ?, ?)`, [newMember.user.id, request[0].user_id, guild.id, category.id]);
    }
});

client.on('message', async (msg) => {
    if(!msg.guild || msg.author.id == client.user.id || msg.author.bot)return;
    
    if(!await newEveryone(msg.guild)){
        msg.channel.send(`error, unable to create role "NewEveryone"... i cant do my job without ADMINISTRATOR permission :/`);
        return;
    }
    await db.query(`INSERT INTO servers (id) VALUES (?) ON DUPLICATE KEY UPDATE id = id;`, [msg.guild.id]);
    const sqlserver = (await db.query(`SELECT * FROM servers WHERE id = ?`, [msg.guild.id]))[0][0]
    if(sqlserver)callCorrespondingCommand(sqlserver, msg);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if(user.id == client.user.id)return;
    if(reaction.message.embeds && reaction.message.embeds.length > 0){
        const embed = reaction.message.embeds[0];
        if(embed.footer && embed.footer.text && /[a-z][0-9]{18}/gi.exec(embed.footer.text)){
            const indicator = embed.footer.text.charAt(0);
            const botid = embed.footer.text.substring(1, embed.footer.text.length);
            //console.log(indicator, botid, reaction.message.channel.guild.id);
            const bot = (await db.query(`SELECT * FROM bots WHERE bot_id = ? AND server_id = ?`, [botid, reaction.message.channel.guild.id]))[0];
            if(bot.length != 0){
                if(indicator == 'i' && reaction._emoji.name == '📩'){
                    const botcat = await reaction.message.channel.guild.channels.cache.get(category_id);
                    if(botcat){
                        botcat.updateOverwrite(await reaction.message.channel.guild.members.cache.get(user.id), {VIEW_CHANNEL: true, USE_VAD: true, SPEAK: true, CONNECT: true, USE_EXTERNAL_EMOJIS: true, READ_MESSAGE_HISTORY: true, ATTACH_FILES: true, EMBED_LINKS: true, SEND_MESSAGES: true, STREAM: true, ADD_REACTIONS: true});
                    }
                }
            }
            const request = (await db.query(`SELECT * FROM requests WHERE bot_id = ? AND server_id = ?`, [botid, reaction.message.channel.guild.id]))[0];
            if(request.length > 0 && (user.id == request[0].user_id || (await reaction.message.channel.guild.members.cache.get(user.id)).hasPermission('ADMINISTRATOR'))){
                if(indicator == 'j' && reaction._emoji.name == '❌'){
                    if(!request[0].cancelled){
                        db.query(`UPDATE requests SET cancelled = TRUE WHERE bot_id = ? AND server_id = ?`, [botid, reaction.message.channel.guild.id])
                        reaction.message.channel.send({embed: {
                            color: 0xFF0000, title: `request declined`,
                            description: `request from <@${request[0].user_id}> for bot id ${botid} was declined by <@${user.id}>`}});
                    }
                }
            }
        }
    }
});

function registerCommand(commande, argsformat, permissions, func){
    //func args must be => sqlserv, msg, args
    commandes.forEach(cmd => {if(cmd.cmd == commande)console.log(`double entry for command ${commande}!!!!`)});
    commandes.push({
        cmd: commande,
        args: argsformat,
        perms: permissions,
        func: func
    });
}

async function callCorrespondingCommand(sqlserver, msg){
    if(!msg.content.startsWith(sqlserver.prefix))return;
    const args = msg.content.split(' ');
    const cmd = args.shift().substring(sqlserver.prefix.length);
    let func = [];
    commandes.forEach(commande => {
        if(commande.cmd == cmd){
            let match = false;
            let haveperms = true;
            if(commande.perms)commande.perms.forEach(perm => {
                haveperms = msg.member.hasPermission(perm)?haveperms:false;
            });
            haveperms = msg.author.id == config.superuser?true:haveperms;
            if(!commande.args || (commande.args.length <= args.length)){
                if(haveperms){
                    match = true;
                    if(commande.args){
                        for(i in commande.args){
                            match = new RegExp(commande.args[i], `gi`).exec(args[i])?match:false;
                        }
                    }
                    if(match)func.push(commande.func);
                }
            }
            if(haveperms && !match){
                let expectedargs = ``;
                commande.args.forEach(arg => expectedargs = `${expectedargs} <${arg}>`)
                msg.channel.send({embed: {
                    color: 0xFF0000, title: `Invalid command format for "${cmd}"`,
                    description: `Please respect format for command "${sqlserver.prefix}${cmd} ${expectedargs}".\nUse "${sqlserver.prefix}help ${cmd}" to know more about it.`}});
                }
            }
    });
    if(func.length>0){
        await db.query(`INSERT INTO users (id) VALUES (?) ON DUPLICATE KEY UPDATE id = id;`, [msg.author.id]);//TODO: remove and optimize SQL requests
    }
    func.forEach(fnc => fnc(sqlserver, msg, args));
}


async function addbot(sqlserver, msg, args){
    const isbanned = (await db.query(`SELECT * FROM bans WHERE user_id = ? AND server_id = ?`, [msg.author.id, msg.guild.id]))[0].length > 0;
    if(isbanned){
        msg.channel.send({embed: {
            color: 0xFF0000, title: `sorry but you are "bot banned" on this server`,
            description: `please contact server staff to know more.`}});
        return;
    }
    const haverequest = (await db.query(`SELECT * FROM requests WHERE user_id = ? AND server_id = ?`, [msg.author.id, msg.guild.id]))[0];
    const havebot = (await db.query(`SELECT * FROM bots WHERE user_id = ? AND server_id = ?`, [msg.author.id, msg.guild.id]))[0];
    const userpremium = (await db.query(`SELECT premium FROM users WHERE id = ?`, [msg.author.id]))[0][0].premium;
    let oneuncancelled = false;
    haverequest.forEach(req => {
        if(!req.cancelled)oneuncancelled = true;
    })
    if((oneuncancelled || havebot.length>0) && !userpremium && !sqlserver.premium && config.superuser != msg.author.id){
        msg.channel.send({embed: {
            color: 0xFF0000, title: `you have already a pending request/bot on this server`,
            description: `please buy premium to expand bots number\n=> (User premium)[#] for unlimited bots on every servers\n=> (Server premium)[#] for unlimited bots for everyone on this server`}});
        return;
    }
    if(haverequest.length>0 && !haverequest[0].cancelled){
        msg.channel.send({embed: {
            color: 0xFF0000, title: `you have already a pending request for this bot`,
            description: `staff have to accept your request, be patient...`}});
        return;
    }
    db.query(`INSERT INTO requests (user_id, server_id, bot_id)
        VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cancelled = FALSE`, [msg.author.id, msg.guild.id, args[0]]);
    let chanreq = sqlserver.requests?sqlserver.requests:msg.channel.id;
    msg.guild.channels.cache.get(chanreq).send({embed: {
        color: 0x00FF00, title: `bot request`,
        description: `from <@${msg.author.id}>\n[https://discord.com/api/oauth2/authorize?client_id=${args[0]}&permissions=0&scope=bot](https://discord.com/api/oauth2/authorize?client_id=${args[0]}&permissions=0&scope=bot)\nreact with ❌ to refuse`,
        footer: {"text": `j${args[0]}`}}}).then(reqmsg => reqmsg.react('❌'));
    msg.channel.send({embed: {
        color: 0x00FF00, title: `bot request`,
        description: `<@${msg.author.id}>, your request for the bot id ${args[0]} have been successfuly sent to the staff.`}});
}


async function rembot(sqlserver, msg, args){
    const request = (await db.query(`SELECT * FROM requests WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    const bot = (await db.query(`SELECT * FROM bots WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    const botownid = bot.length>0?bot[0].user_id:request.length>0?request[0].user_id:0;
    if((request.length==0 && bot.length == 0) || (!msg.member.hasPermission('ADMINISTRATOR') && msg.author.id != botownid && config.superuser != msg.author.id)){
        msg.channel.send({embed: {color: 0xFF0000, title: `this bot in not on the server and you dont have pending request for him`}});
        return;
    }
    if(request.length>0)db.query(`UPDATE requests SET cancelled = TRUE WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    if(bot.length>0){
        const botcategid = bot[0].category_id;
        const cat = await msg.guild.channels.cache.get(botcategid);
        if(cat){
            cat.children.forEach(chan => chan.delete());
            cat.delete();
        }
        msg.guild.members.cache.each(member => {
            if(member.id == bot[0].bot_id)member.kick();
        });
        db.query(`DELETE FROM bots WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    }
    msg.channel.send({embed: {
        color: 0x00FF00, title: `Bot removed!`,
        description: `<@${args[0]}>, bot have been successfuly ejected from the server`}});
}


async function botinvite(sqlserver, msg, args){
    const bot = (await db.query(`SELECT * FROM bots WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    if(bot.length == 0){
        msg.channel.send({embed: {color: 0xFF0000, title: `this bot in not on the server`}});
        return;
    }
    let botName;
    msg.guild.members.cache.each(member => {if(member.user.id == args[0])botName = member.user.username});
    msg.channel.send({embed: {
        color: 0x0000FF, title: `invite for joining bot "${botName}"`,
        description: `react to join the the bot category.\n📢 to leave the category, please use "${sqlserver.prefix}botleave ${args[0]}" 📢`,
        footer: {"text": `i${args[0]}`}}}).then(sended => sended.react('📩'));
}


async function botleave(sqlserver, msg, args){
    const bot = (await db.query(`SELECT * FROM bots WHERE bot_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    if(bot.length == 0){
        msg.channel.send({embed: {color: 0xFF0000, title: `this bot in not on the server`}});
    }
    msg.guild.channels.cache.get(bot[0].category_id).permissionOverwrites.get(msg.author.id).delete();
    msg.channel.send({embed: {color: 0x00FF00, title: `you successfully leaved!`}});
}


async function report(sqlserver, msg, args){
    let chanrep = sqlserver.reports?sqlserver.reports:msg.channel.id;
    let repcontent = Array.from(args);
    repcontent.shift();
    let attachurl = [];
    msg.attachments.forEach(attach => attachurl.push(attach.url));
    msg.guild.channels.cache.get(chanrep).send({embed: {
        color: 0xFF0000, title: `Bot report for ${args[0]}`,
        description: `reported bot <@${args[0]}>\n===================\nfrom <@${msg.author.id}>\n${repcontent.join(' ')}\n${attachurl.join('\n')}`}});
}


async function setrequests(sqlserver, msg, args){
    db.query(`UPDATE servers SET requests = ? WHERE id = ?`, [msg.channel.id, msg.guild.id]);
    msg.channel.send({embed: {color: 0x00FF00, title: `This channel will now receive the bot requests`}});
}


async function setreports(sqlserver, msg, args){
    db.query(`UPDATE servers SET reports = ? WHERE id = ?`, [msg.channel.id, msg.guild.id]);
    msg.channel.send({embed: {color: 0x00FF00, title: `This channel will now receive the bot reports`}});
}


async function banbots(sqlserver, msg, args){
    const bots = (await db.query(`SELECT * FROM bots WHERE user_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    bots.forEach(bot => {
        const btmb = msg.guild.members.cache.get(bot);
        if(btmb)btmb.kick();
    })
    db.query(`DELETE FROM bots WHERE user_id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    db.query(`UPDATE FROM users SET banned = TRUE WHERE id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    msg.channel.send({embed: {
        color: 0x00FF00, title: `bots removed`,
        description: `all bots from user <@${args[0]}> were removed from the server.`}});
}


async function ban(sqlserver, msg, args){
    const bots = (await db.query(`SELECT * FROM bots WHERE user_id = ? AND server_id = ?`, [args[0], msg.guild.id]))[0];
    bots.forEach(bot => {
        const btmb = msg.guild.members.cache.get(bot);
        if(btmb)btmb.kick();
    })
    const mmbr = msg.guild.members.cache.get(args[0]);
    if(mmbr)mmbr.ban();
    db.query(`DELETE FROM bots WHERE user_id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    db.query(`UPDATE FROM users SET banned = TRUE WHERE id = ? AND server_id = ?`, [args[0], msg.guild.id]);
    msg.channel.send({embed: {
        color: 0x00FF00, title: `bots removed`,
        description: `user <@${args[0]}> have been banned and all of his bots were removed from the server.`}});
}


async function help(sqlserver, msg, args){
    if(args.length != 0 && args[0] == "addbot") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to your bot client id (can be found in your discord dev pannel, in the bot invite link, or on doing right-click and copy id on your bot) \nex: "${sqlserver.prefix}${args[0]} 804322279939899413" allow you to add your own bot to the server.\nSpecific permissions and channels will be created for you and your bot.\n⚠⚠Your bot and you have to respect server rules!⚠⚠\nA staff member have to accept your request, be patient.`}});
    else if(args.length != 0 && args[0] == "rembot") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to your bot client id (can be found in your discord dev pannel, in the bot invite link, or on doing right-click and copy id on your bot) \nex: "${sqlserver.prefix}${args[0]} 804322279939899413" remove the bot from the server`}});
    else if(args.length != 0 && args[0] == "report") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}> <message>" the <[0-9]{18}> field correspond to the bot client id (can be found on doing right-click and copy id on the bot) \nex: "${sqlserver.prefix}${args[0]} 804322279939899413 unwanted mp" allow you to report a bot to staff members (please provide screenshot in your message)`}});
    else if(args.length != 0 && args[0] == "botinvite") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to the bot client id (can be found on doing right-click and copy id on the bot) \nex: "${sqlserver.prefix}${args[0]} 804322279939899413" create an invitation to other users to join your bot channel.`}});
    else if(args.length != 0 && args[0] == "botleave") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to the bot client id (can be found on doing right-click and copy id on the bot) \nex: "${sqlserver.prefix}${args[0]} 804322279939899413" make you leave the bot channel.`}});
    else if(args.length != 0 && args[0] == "setrequests") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]}" set the channel where staff will receive bot requests.`}});
    else if(args.length != 0 && args[0] == "setreports") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]}" set the channel where staff will receive bot reports.`}});
    else if(args.length != 0 && args[0] == "report") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}> <.+>" report a bot to staff members`}});
    else if(args.length != 0 && args[0] == "banbots") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to the user id (can be fout on doing right-click on user). this command will kick ALL BOTS from à user. (to kick a specific bot, look at the "${sqlserver.prefix}rembot." command)`}});
    else if(args.length != 0 && args[0] == "ban") msg.channel.send({embed: {
        color: 0x3333FF, title: `help for "${args[0]}"`,
        description: `"${sqlserver.prefix}${args[0]} <[0-9]{18}>" the <[0-9]{18}> field correspond to the user id (can be fout on doing right-click on user). this command will do the same than the "${sqlserver.prefix}banbots" command but ban the user too.`}});
    else msg.channel.send({embed: {
        color: 0x3333FF, title: `general help`,
        fields: [
            {
                name: `.`,
                value: `\nMember section`
            },
            {
                name: `${sqlserver.prefix}addbot <botid>`,
                value: `to add your bot on the server`
            },
            {
                name: `${sqlserver.prefix}rembot <botid>`,
                value: `to remove your bot from the server`
            },
            {
                name: `${sqlserver.prefix}report <botid> <message>`,
                value: `to report a bot to the staff`
            },
            {
                name: `${sqlserver.prefix}botinvite <botid>`,
                value: `create an invite to your bot channel`
            },
            {
                name: `${sqlserver.prefix}botleave <botid>`,
                value: `leave bot channel`
            },
            {
                name: `.`,
                value: `\nAdmin section`
            },
            {
                name: `${sqlserver.prefix}setrequests`,
                value: `set channel to receive requests`
            },
            {
                name: `${sqlserver.prefix}setreports`,
                value: `set channel to receive reports`
            },
            {
                name: `${sqlserver.prefix}rembot <botid>`,
                value: `to remove a bot from the server`
            },
            {
                name: `${sqlserver.prefix}banbots <botid>`,
                value: `ban bots from this user and disable possibility to do other requests`
            },
            {
                name: `${sqlserver.prefix}ban <botid>`,
                value: `do like banbots but ban the user too`
            }
              
          ]
        }});
}

db.query(`CREATE TABLE IF NOT EXISTS users (
    id BIGINT(18) NOT NULL,
    premium BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE INDEX id_UNIQUE (id ASC) VISIBLE);`);
db.query(`CREATE TABLE IF NOT EXISTS servers (
    id BIGINT(18) NOT NULL,
    premium BOOLEAN NOT NULL DEFAULT FALSE,
    prefix VARCHAR(1) NOT NULL DEFAULT '+',
    requests BIGINT(18),
    reports BIGINT(18),
    PRIMARY KEY (id),
    UNIQUE INDEX id_UNIQUE (id ASC) VISIBLE);`);
db.query(`CREATE TABLE IF NOT EXISTS bots (
    bot_id BIGINT(18) NOT NULL,
    user_id BIGINT(18) NOT NULL,
    server_id BIGINT(18) NOT NULL,
    category_id BIGINT(18) NOT NULL,
    PRIMARY KEY (bot_id, user_id, server_id),
    INDEX fk_bot_user_id_idx (user_id ASC) VISIBLE,
    INDEX fk_bot_server_id_idx (server_id ASC) VISIBLE,
    CONSTRAINT fk_bot_user_id
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
    CONSTRAINT fk_bot_server_id
      FOREIGN KEY (server_id)
      REFERENCES servers (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);`);
db.query(`CREATE TABLE IF NOT EXISTS bans (
    user_id BIGINT(18) NOT NULL,
    server_id BIGINT(18) NOT NULL,
    PRIMARY KEY (user_id, server_id),
    INDEX fk_ban_server_id_idx (server_id ASC) VISIBLE,
    CONSTRAINT fk_ban_user_id
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
    CONSTRAINT fk_ban_server_id
      FOREIGN KEY (server_id)
      REFERENCES servers (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);`);
db.query(`CREATE TABLE IF NOT EXISTS requests (
    user_id BIGINT(18) NOT NULL,
    server_id BIGINT(18) NOT NULL,
    bot_id BIGINT(18) NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, server_id, bot_id),
    INDEX fk_request_server_id_idx (server_id ASC) VISIBLE,
    INDEX fk_request_bot_id_idx (bot_id ASC) VISIBLE,
    CONSTRAINT fk_request_user_id
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION,
    CONSTRAINT fk_request_server_id
      FOREIGN KEY (server_id)
      REFERENCES servers (id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION);`);

client.login(config.token);