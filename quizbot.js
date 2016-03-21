// V1.03

/* 
mySQL Database Table Structure & sample question

CREATE TABLE IF NOT EXISTS `questions` (
  `question_id` int(11) NOT NULL AUTO_INCREMENT,
  `question` varchar(255) NOT NULL,
  `answer` varchar(255) NOT NULL,
  `also_answer` varchar(255) NOT NULL COMMENT 'Pipe separated optional acceptable answers',
  `date_used` datetime NOT NULL DEFAULT '1975-01-01 00:00:00',
  PRIMARY KEY (`question_id`),
  KEY `date_used` (`date_used`)
);

INSERT INTO `questions` (`question`, `answer`, `also_answer`) VALUES
('In pantomime, who is Aladdin''s Mother?', 'Widow Twankey', 'Twankey|Twanky|Widow Twanky');
*/

// Required libraries...
var fs 			= require('fs');
var _ 			= require('underscore');
var vok			= require('vok');
var moment	= require('moment');
var mysql 	= require('mysql');
var Slack 	= require('slack-client');

// Config...
var config 	= require('./config.json');
if(!vok(config,'config.token')
|| !vok(config,'config.quizchannel')
|| !vok(config,'config.questionsperquiz')
|| !vok(config,'config.db_config')
|| !vok(config,'config.db_config.host')
|| !vok(config,'config.db_config.user')
|| !vok(config,'config.db_config.password')
|| !vok(config,'config.db_config.database')) {

	console.log('Please check your config for all required values!');
	console.log('Your file should look like : ');
	console.log('{');	
	console.log('	"token": "SLACKTOKENGOESHERE",');
	console.log('	"quizchannel": "#SLACKQUIZCHANNEL",');
	console.log('	"questionsperquiz": 10,');
	console.log('	"db_config": {');
	console.log('		"host"    : "MYSQLHOST",');
  console.log('		"user"    : "MYSQLUSERNAME",');
  console.log('		"password": "MYSQLPASSWORD",');
  console.log('		"database": "MYSQLDATABASE"');
	console.log('	}');
	console.log('}');
	
	process.exit();

}

var connection;
var autoMark = true;
var autoReconnect = true;
var slack = new Slack(config.token, autoReconnect, autoMark);
var channel = '';
var quizbotusername = '';		// Username for quizbot account
var quizbotid = '';					// ID for quizbot account
var questions = [];					// Questions to ask
var q = -1;									// Which question are we currently on?
var scores = [];						// Track winning scores
var quizinprogress = false;	// Is a quiz in progress?
var quizpending = false;		// Have we asked if they want a quiz yet?
var answerpending = false;	// Waiting on an answer?
var countdown = false;
var cdm5 = false;
var cdm4 = false;
var cdm3 = false;
var cdm2 = false;
var cdm1 = false;

//----------------------------------------------------------------------------------------

// Maintain an open MySQL connection
var mysqlConnect = function() {

	connection = mysql.createConnection(config.db_config);
	connection.connect(function(err) {
		if(err) {
			console.log('MySQL Error unable to make connection', err);
			setTimeout(mysqlConnect, 5000); 
		} else {
			console.log('MySQL connection opened');
		}
	});

	connection.on('error', function(err) {
		console.log('MySQL Error', err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
			mysqlConnect();	// Lost due to either server restart, or a connnection idle timeout
		} else {                                     
			throw err;                                  
		}
	});
	
}

//----------------------------------------------------------------------------------------

// Connect to Slack and listen
slack.on('open', function() {

	var channel, channels, group, groups, id, messages, unreads;
  channels = [];
  groups = [];
  unreads = slack.getUnreadCount();
  
  channels = (function() {
    var _ref, _results;
    _ref = slack.channels;
    _results = [];
    for (id in _ref) {
      channel = _ref[id];
      if (channel.is_member) {
        _results.push("#" + channel.name);
      }
    }
    return _results;
  })();
  
  groups = (function() {
    var _ref, _results;
    _ref = slack.groups;
    _results = [];
    for (id in _ref) {
      group = _ref[id];
      if (group.is_open && !group.is_archived) {
        _results.push(group.name);
      }
    }
    return _results;
  })();
	
	quizbotusername = slack.self.name;
	quizbotid = slack.self.id;
  
  //console.log("Welcome to Slack. You are @" + slack.self.name + " of " + slack.team.name);
  //console.log('You are in: ' + channels.join(', '));
  //console.log('As well as: ' + groups.join(', '));
  //messages = unreads === 1 ? 'message' : 'messages';
  //return console.log("You have " + unreads + " unread " + messages);

	return true;
	
});

// Interpret Slack message
slack.on('message', function(message) {

  var channel = slack.getChannelGroupOrDMByID(message.channel);
  var user = slack.getUserByID(message.user);
  var type = message.type;
  var ts = message.ts;
  var text = message.text;
  var channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';
  		channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
  var userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";

  console.log("Slack Message: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"");
  
  if (type === 'message' && (text != null) && (channel != null)) {
  
  	// If this is a direct message to QuizBot (in the quiz channel), and we've not a quiz in progress, confirm a quiz kickoff...
  	if(channelName == config.quizchannel) {
  	
  		// Direct message...
  		if(text.toLowerCase().indexOf('@' + quizbotid.toLowerCase())!==-1) {
		
				// Quiz in progress. 
				if(quizinprogress) {
				
					// Enable options for abort and so on...
					
					
					
					
					
					
					
					
					
					
					var msg = [];
					msg.push('No time to chit-chat! There\'s a quiz on!');
					slackSendChannel(config.quizchannel,msg);
					
					
					
					
					
					
					
				
				}
		
				// Wait for a yes/no to start the quiz.
				else if(quizpending) {
			
					quizPending(text,true);

				}
				
				// Being asked to start a quiz?
				else {
				
					if(text.toLowerCase().indexOf('have a quiz')!==-1
					|| text.toLowerCase().indexOf('have another quiz')!==-1
					|| text.toLowerCase().indexOf('like a quiz')!==-1) {
			
						var msg = [];
						msg.push('Did someone say quiz?!?');
						msg.push('Would you like a quiz? Just answer yes or no!');
						msg.push('A quiz? That\'s the thing I love most in life! Shall I start?');
						msg.push('Shall we have a quiz? Is that what you want?');
						slackSendChannel(config.quizchannel,msg);
						quizpending = true;

					} else if(text.toLowerCase().indexOf('don\'t want a quiz')!==-1) {
			
						var msg = [];
						msg.push('DON\'T want a quiz?!? You\'re crazy. They\'re the best things ever.');
						msg.push('I wasn\'t offering');
						slackSendChannel(config.quizchannel,msg);

					} else if(text.toLowerCase().indexOf('how many questions')!==-1) {
			
						var query = "SELECT COUNT(*) AS count FROM questions WHERE date_used = '1975-01-01 00:00:00'";
						connection.query(query, function(err, rows, fields) {

							if (!err) {
								var msg = [];
								if(rows[0].count == 0) {
									msg.push('I\'m all out.');
									msg.push('None. Nil. Zero. Zip.');
								} else {
									if(rows[0].count < 11) {
										msg.push('Very few. Just ' + rows[0].count + ' question' + (rows[0].count!=1?'s':'') + ' left');
									}						
									msg.push('By my reckoning, I\'ve got about ' + rows[0].count + ' question' + (rows[0].count!=1?'s':'') + ' left');
								}
								slackSendChannel(config.quizchannel,msg);
							}
	
						});							

					} else {
					
						// Chit-chat
						
						if(text.toLowerCase().indexOf('commands')!==-1) {
			
							var msg = [];
							msg.push('Nobody commands ' + quizbotusername);
							slackSendChannel(config.quizchannel,msg);
							
						} 
						
						else if(text.toLowerCase().indexOf('giraffe')!==-1) {
						
							var msg = [];
							msg.push('http://bfy.tw/23U4');
							slackSendChannel(config.quizchannel,msg);
								
						}						

						else if(text.toLowerCase().indexOf('kitten')!==-1) {
						
							if(text.toLowerCase().indexOf('dead')!==-1
							|| text.toLowerCase().indexOf('mutilated')!==-1) {
			
								var msg = [];
								msg.push('I\'m afraid I can\'t do that.');
								slackSendChannel(config.quizchannel,msg);
							
							} else {
			
								var msg = [];
								msg.push('http://thecatapi.com/api/images/get?' + Date.now());
								slackSendChannel(config.quizchannel,msg);
							
							}
							
						}
						
						else if(text.toLowerCase().indexOf('doge')!==-1) {
			
							var msg = [];
							msg.push('http://i.imgur.com/qM6KaEy.gifv');
							slackSendChannel(config.quizchannel,msg);
							
						}									
						
						else if(text.toLowerCase().indexOf('what is 2 + 2')!==-1
						|| text.toLowerCase().indexOf('what is 2+2')!==-1) {
			
							var msg = [];
							msg.push('3');
							msg.push('Maths?');
							msg.push('Er... Hold on. I know this one. 4?');
							slackSendChannel(config.quizchannel,msg);
							
						}
						
						else {
						
							var banterAway = false;
							fs.readFile('./banter.json', 'utf8', function(err, banter) {
	
								if (err) throw err;
								
								banter = JSON.parse(banter);
								
								// Check for banter relating to this specific individual...

								if(!_.isUndefined(banter[userName])) {
									for(var b in banter[userName]) {
										if(text.toLowerCase().indexOf(b)!==-1) {			
											var msg = banter[userName][b];
											slackSendChannel(config.quizchannel,msg);
											banterAway = true;
											break;							
										}							
									}
								}
								
								// Check for general banter...
								
								if(!banterAway) {			
									if(!_.isUndefined(banter['@'])) {
										for(var b in banter['@']) {
											if(text.toLowerCase().indexOf(b)!==-1) {			
												var msg = banter['@'][b];
												slackSendChannel(config.quizchannel,msg);
												banterAway = true;
												break;							
											}							
										}
									}
								}
								
								if(!banterAway) {	
									var silence = Math.floor(Math.random() * 10) + 1;
									if(silence == 5) {										
										var msg = [];
										msg.push('I\'ve not been programmed to respond to that');
										msg.push('I\'m not following what you\'re saying');
										msg.push('WAT');
										slackSendChannel(config.quizchannel,msg);
										banterAway = true;
									}
								}

							});
							
						}	
					
					}				
			
				}
				
			} else {
			
				// Non-direct message				
				if(quizinprogress) {
				
					// Must be the answer to a question?
					if(q > -1) {
					
						checkAnAnswer(userName,text,function(correct) {
						
							if(correct == true) {

								// If answer is correct...
								answerpending = false;
								cdm5 = false;
								cdm4 = false;
								cdm3 = false;
								cdm2 = false;
								cdm1 = false;
						
							} else {

								// If answer isn't correct...						
								// If countdown < 10 seconds, and answers still coming in, extend the countdown to be 10 seconds
								if(countdown.diff(moment(), 'seconds') < 10) {
									countdown = moment().add(10, 'seconds');
									cdm5 = false;
									cdm4 = false;
									cdm3 = false;
									cdm2 = false;
									cdm1 = false;
								}
								
							}
					
						});					
					
					}	else {
					
						var msg = [];
						msg.push('Too eager! Wait \'till I ask a question, eh?');
						msg.push('Hold on, I\'ve not asked a question yet!');
						slackSendChannel(config.quizchannel,msg);
					
					}
				
				}
				
				// Wait for a yes/no to start the quiz
				else if(quizpending) {
				
					quizPending(text,false);

				}
				
				else {
				
					// Chit-chat. Not direct to Quizbot though...
					
				}
				
			}
  	
  	}

  	return true;
    
  } else {
  
    var typeError = type !== 'message' ? "unexpected type " + type + "." : null;
    var textError = text == null ? 'text was undefined.' : null;
    var channelError = channel == null ? 'channel was undefined.' : null;
    var errors = [typeError, textError, channelError].filter(function(element) {
      return element !== null;
    }).join(' ');
    return console.log("@" + slack.self.name + " could not respond. " + errors);
    
  }
  
});

slack.on('error', function(error) {
  return console.error("Error: " + error);
});

//----------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------

// Wait for a bit...
var idling_ticker = function(duration,current,callback) {
	process.stdout.write('.');
	setTimeout(function() {
		current = current + 1;
		if(current >= duration) {
			console.log('');
			return callback();
		} else {
			idling_ticker(duration,current,callback);
		}
	}, 1000);	
}

var pause = function(duration,callback) {
	idling_ticker(duration,0,function() {
		return callback();
	});
}

// Helper to spit out a message
var slackSendChannel = function(channelname,msg) {

	var boolDone = false;
	
	if(_.isArray(msg)) {
		msg = msg[Math.floor(Math.random() * msg.length)];
	}
	
	var c = slack.channels;
	for (id in c) {
		channel = c[id];
    if (channel.is_member && ('#' + channel.name == channelname || channel.name == channelname)) {
			channel.send(msg);
			boolDone = true;
		}
	}
	
	if(!boolDone) {
		console.log('Unable to send message to channel ' + channelname);
	}

}

// Waiting for a yes/no answer to start a quiz...
var quizPending = function(text,wasmessagedirect) {

	if(text.toLowerCase().indexOf('yes')!==-1
	|| text.toLowerCase().indexOf('ok')!==-1) {
				
		var msg = [];
		msg.push('You beauty! Give me a moment to see what questions I have.');
		msg.push('Brill. I\'ll go see what questions I can dig up.');
		msg.push('Awesome. I\'ve been looking forward to this all week.');
		msg.push('Excellent! Let me dig out my bumper book of quiz questions.');
		slackSendChannel(config.quizchannel,msg);
		quizpending = false;
		quizinprogress = true;
		doAQuiz();

	} 

	else if(text.toLowerCase().indexOf('no')!==-1) {

		var msg = [];
		msg.push('OK :(');
		msg.push('Alright then. Maybe some other time?');
		msg.push('As you wish!');
		msg.push('No problem');
		msg.push('OK, let me know if you change your mind!');
		slackSendChannel(config.quizchannel,msg);
		quizpending = false;
		quizinprogress = false;

	}
	
	else {
	
		if(wasmessagedirect) {
	
			var msg = [];
			msg.push('Would you like a quiz? Yes, or no?');
			msg.push('I\'m just waiting for a yes or no answer!');
			msg.push('Quiz - yes or no?');
			msg.push('I asked if you wanted a quiz - just answer yes or no');
			slackSendChannel(config.quizchannel,msg);
			
		}
	
	}

}

var checkLoopExact = function(answer) {

	if(!_.isUndefined(questions[q].accept)
	&& answer!=""
	&& answer!=" ") {

		// Exactly right!
		for(var a in questions[q].accept) {	
			if(answer == questions[q].accept[a]) {
				return true;
			}				
		}
	
	}
	
	return false;

}

var checkLoopAlmost = function(answer) {

	if(!_.isUndefined(questions[q].close)
	&& answer!=""
	&& answer!=" ") {
		
		// Maybe not spot on...
		for(var a in questions[q].close) {			
			if(answer == questions[q].close[a]) {
				return true;
			}				
		}	
	
	}
	
	return false;

}

// Was the given answer correct?
var checkAnAnswer = function(user,answer,callback) {

	var correct = false;
	var closeenough = false;
	
	if(answerpending) {
	
		// Format the users answer to allow for minor spelling/capitalisation issues
		if(!correct) {
			var a = answer.toLowerCase();				
			correct = checkLoopExact(a);
		}		
				
		if(!correct) {			
			var a = answer.toLowerCase().replace(/\W/g, '');
			closeenough = correct = checkLoopAlmost(a);
		}

		// If answer is correct, increment that users score...
		if(correct) {
	
			if(_.isUndefined(scores[user])) {
				scores[user] = 0;
			}
			scores[user] = scores[user] + 1;
			
			console.log(user + ' now has a score of ' + scores[user]);
		
			if(closeenough) {
				var msg = [];
				msg.push(user + ' is correct! Well, close enough anyway. I was looking for ' + questions[q].answer);
				msg.push('Close enough. I\'m giving it to ' + user + '. The answer was ' + questions[q].answer);				
			} else {
				var msg = [];
				msg.push(user + ' is correct!');
				msg.push(user + ' has the answer!');
				msg.push(user + ' is right!');
			}
			slackSendChannel(config.quizchannel,msg);
	
		} 
		
	}
	
	return callback(correct);

}

// Listen for answers, but countdown so we can give up if nobody gets the right one
var waitForAnswer = function(callback) {
	
	console.log('Waiting for answer...');

	(function loopHell() {
	
		if(answerpending) {
		
			if(countdown.isBefore()) {
			
				// Time's up!!!
				var msg = 'Out of time!';
				slackSendChannel(config.quizchannel,msg);
				
				// Reveal the answer...
				var msg = 'The answer was : ' + questions[q].answer;
				slackSendChannel(config.quizchannel,msg);

				answerpending = false;
				
				pause(3,function() {
			
					return callback();
				
				});
			
			} else {

				var m = moment();	
				if(countdown.diff(m, 'seconds') < 1) {
					if(!cdm1) {
						slackSendChannel(config.quizchannel,'1');
						cdm1 = true;
					}		
				}	
				else if(countdown.diff(m, 'seconds') < 2) {
					if(!cdm2) {
						slackSendChannel(config.quizchannel,'2');
						cdm2 = true;
					}			
				}
				else if(countdown.diff(m, 'seconds') < 3) {		
					if(!cdm3) {
						slackSendChannel(config.quizchannel,'3');
						cdm3 = true;
					}			
				}
				else if(countdown.diff(m, 'seconds') < 4) {		
					if(!cdm4) {
						slackSendChannel(config.quizchannel,'4');
						cdm4 = true;
					}			
				}	
				else if(countdown.diff(m, 'seconds') < 5) {
					if(!cdm5) {
						slackSendChannel(config.quizchannel,'5');
						cdm5 = true;
					}		
				}
			
				setTimeout(loopHell,0);
			
			}
			
		} else {
		
			// Must've been answered!
			return callback();
		
		}
		
	})();

}

// Ask a question and wait for an answer (or a set amount of time to pass)
var doAQuestion = function() {

	if(!_.isUndefined(questions[q])) {
		
		// Prep a set of values we'll accept as an answer
		var answer = questions[q].answer;
		var accept = [];
		
		accept.push(answer.toLowerCase());	// Lowercase exact
		
		var t = answer.toLowerCase().replace(/\W/g, '');
		if(t!="" && t!=" ") {
			accept.push(t);	// Lowercase non-alphanumeric stripped
		}
		
		questions[q].accept = accept;
		
		// And any values we'll accept as being close enough :)
		var also_answer = questions[q].also_answer.split('|');
		var close = [];
		
		for(var aa in also_answer) {
		
			close.push(also_answer[aa].toLowerCase());	// Lowercase exact
			
			var t = also_answer[aa].toLowerCase().replace(/\W/g, '');
			if(t!="" && t!=" ") {
				close.push(t);	// Lowercase non-alphanumeric stripped
			}			
		
		}

		questions[q].close = close;
		
		answerpending = true;
		
		// Ask the question...
		var msg = questions[q].question;
		slackSendChannel(config.quizchannel,msg);
	
		// Update question in MySQL as asked...	
		var query = "UPDATE questions SET date_used = NOW() WHERE question_id = " + questions[q].question_id;
		connection.query(query, function(err, rows, fields) {

			// Start counter (1 min window to get right answer) and await incoming answers...
			countdown = moment().add(1, 'm');
			waitForAnswer(function() {
		
				// Move onto next question...
				q++;				
				pause(2,function() {
					doAQuestion();				
				});		

			});
			
		});

	} else {
	
		// All done?
		
		var msg = [];
		msg.push('That\'s your lot!');
		msg.push('Game over man!');
		msg.push('That was the last question!');
		slackSendChannel(config.quizchannel,msg);
		
		// Report scores		
		pause(2,function() {
		
			var count = 0;
			var max = 0;
			var maxusers = [];
			for(var s in scores) {
				count++;
				if(scores[s] > max) {
					max = scores[s];
					maxusers = [];
					maxusers.push(s);
				}	
				else if(scores[s] == max) {
					maxusers.push(s);
				}			
			}		

			if(count == 0) {
			
				var msg = [];
				msg.push('That was a pretty poor performance. Nobody scored anything!');
				msg.push('Zero scores all round. Rubbish!');
				msg.push('0 scores from anyone. What are they teaching in schools these days?');
				slackSendChannel(config.quizchannel,msg);
				
			} else {
			
				var msg = [];
				msg.push('Final scores were:');
				msg.push('Scores on the doors:');
				slackSendChannel(config.quizchannel,msg);
				for(var s in scores) {
					var msg = s + ' = ' + scores[s];
					slackSendChannel(config.quizchannel,msg);				
				}
				
				if(maxusers.length > 1) {
				
					if(maxusers.length == 2) {
						var u = maxusers[0] + ' and ' + maxusers[1];
					} else {
						var u = '';
						for(var m=0;m<(maxusers.length - 1);m++) {
							u+= maxusers[m] + ', ';
						}
						u+= ' and ' + maxusers[(maxusers.length - 1)];
					}
				
					var msg = [];
					msg.push('That makes for a tie between ' + u + '!');
					slackSendChannel(config.quizchannel,msg);
				
				} else {
					var msg = [];
					msg.push('That makes ' + maxusers[0] + ' the winner!');
					slackSendChannel(config.quizchannel,msg);
				}	
				
				var msg = [];
				msg.push('Hope you enjoyed the quiz!');
				msg.push('Good game, good game!');
				msg.push('Thanks for playing!');
				slackSendChannel(config.quizchannel,msg);
						
			}		
		
			// Reset to go again :)
			quizpending = false;
			quizinprogress = false;
			questions = [];
			scores = [];
			q = -1;
		
		});
		
	}	

}

// Start a quiz
var doAQuiz = function() {

	questions = [];
	scores = [];
	
	getQuestions(config.questionsperquiz,function(response) {
	
		if(response.success == true) {
		
			questions = response.records;
			var numquestions = questions.length;
			
			if(numquestions < config.questionsperquiz) {
				var msg = 'OK guys, I\'ve only got ' + numquestions + ' question' + (numquestions==1?'':'s') + ' left in the pot, so somebody better top me up with some new questions after ' + (numquestions==1?'this please':'these please') + '...';
			} else {
				if(numquestions == 1) {
					var msg = 'OK guys, here comes your one question...';
				} else {
					var msg = 'OK guys, here come your ' + numquestions + ' questions...';
				}
			}
			slackSendChannel(config.quizchannel,msg);
			pause(2, function() {
				
				var msg = 'Ready?';
				slackSendChannel(config.quizchannel,msg);
				pause(2, function() {
					
					var msg = '3';
					slackSendChannel(config.quizchannel,msg);
					pause(2, function() {
					
						var msg = '2';
						slackSendChannel(config.quizchannel,msg);
						pause(2, function() {
						
							var msg = '1';
							slackSendChannel(config.quizchannel,msg);
							pause(2, function() {
							
								// Loop each question - ask it. 
								// If we get a positive response, keep a score, and move on.
								// Otherwise give a maximum timeout of X seconds before revealing the answer and moving on anyway.
								// Set the date we used up each question as we go.
								
								q = 0;
								doAQuestion();
							
							});		
						
						});
					
					});
				
				});
			
			});

		} else {
		
			// Could not fetch questions
			if(response.err !== false) {
			
				// Tech error!
				var msg = 'Oops. I\'ve hit a technical snag: ' + response.err;
				slackSendChannel(config.quizchannel,msg);
				quizinprogress = false;				
			
			} else {
		
				// No questions?!?
				var msg = 'Sorry guys, I\'m all out of questions! If someone could top me up with some fresh quizes, that\'d be nice. Cheers.';
				slackSendChannel(config.quizchannel,msg);
				quizinprogress = false;
								
			}
			
		}
	
	});

}

var getQuestions = function(count,callback) {

	// success = All OK?
	// err = Technical issue
	// msg = Internal debug help
	// records = Array of $rsQuestions
	
	var query = "SELECT * FROM questions WHERE date_used = '1975-01-01 00:00:00' ORDER BY RAND() LIMIT " + count;

	var outcome = {
		success: false, 
		err: false,
		msg: '',
		records: []
	}

	connection.query(query, function(err, rows, fields) {

		if (err) {
			outcome.msg = err;
			outcome.err = true; 
			return callback(outcome);
		}
		
		if(_.isUndefined(rows[0])) {
			outcome.msg = 'No question(s) found';
			return callback(outcome);
		}

		outcome.success = true;
		outcome.records = [];
		
		for(var c in rows) {		
			outcome.records.push(rows[c]);		
		}

		return callback(outcome);
	
	});	

}

var go = function() {

	mysqlConnect();
	slack.login();
	console.log('Quizbot-a-go-go');

}

// Kick off!
go();