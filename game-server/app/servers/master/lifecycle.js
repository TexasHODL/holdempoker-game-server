/*
* @Author: sushiljainam
* @Date:   2017-07-20 12:15:29
* @Last Modified by:   digvijay
* @Last Modified time: 2018-12-28 13:27:23
*/

/*jshint node: true */
"use strict";

var revertHandler = require("../room/handler/revertLockedHandler");

/**
 * function name is special<br>
 * file name and file location are also special<br>
 * so that, it can be called by pomelo code<br>
 * when? --> when all servers are started
 * 
 * @method afterStartAll
 * @param  {object}      app context variable app
 */
module.exports.afterStartAll = function (app) {
    // refund chips to players from in memory table
    revertHandler.revertAllTables({}, function (response) {
    console.log(response);
    // link to generate this art - http://patorjk.com/software/taag/#p=display&f=ANSI%20Shadow&t=POKERMAGNET
    console.log("\n\n\
    ██████╗  ██████╗ ██╗  ██╗███████╗██████╗ ███████╗██████╗ \n\
    ██╔══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗██╔════╝██╔══██╗\n\
    ██████╔╝██║   ██║█████╔╝ █████╗  ██████╔╝███████╗██║  ██║\n\
    ██╔═══╝ ██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗╚════██║██║  ██║\n\
    ██║     ╚██████╔╝██║  ██╗███████╗██║  ██║███████║██████╔╝\n\
    ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═════╝ \n\
    \n\n\
    ███████╗████████╗ █████╗ ██████╗ ████████╗███████╗██████╗ \n\
    ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██╔══██╗\n\
    ███████╗   ██║   ███████║██████╔╝   ██║   █████╗  ██║  ██║\n\
    ╚════██║   ██║   ██╔══██║██╔══██╗   ██║   ██╔══╝  ██║  ██║\n\
    ███████║   ██║   ██║  ██║██║  ██║   ██║   ███████╗██████╔╝\n\
    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═════╝ \n\
    ");
    });

    // ███╗   ███╗███████╗ ██████╗  █████╗ ██████╗  ██████╗ ██╗  ██╗███████╗██████╗ \n\
    // ████╗ ████║██╔════╝██╔════╝ ██╔══██╗██╔══██╗██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗\n\
    // ██╔████╔██║█████╗  ██║  ███╗███████║██████╔╝██║   ██║█████╔╝ █████╗  ██████╔╝\n\
    // ██║╚██╔╝██║██╔══╝  ██║   ██║██╔══██║██╔═══╝ ██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗\n\
    // ██║ ╚═╝ ██║███████╗╚██████╔╝██║  ██║██║     ╚██████╔╝██║  ██╗███████╗██║  ██║\n\
    // ╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝\n\

    // console.error('-----======== master', app.components.__server__.server.handlerService);
};

/** 
 * other such functions are these: 
 * these all are useful
 */
// beforeStartup
// beforeShutdown
// afterStartup
// 


/*
console.error("\n\
██╗  ██╗███████╗ █████╗ ██████╗ ████████╗██████╗ ███████╗ █████╗ ████████╗\n\
██║  ██║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝\n\
███████║█████╗  ███████║██████╔╝   ██║   ██████╔╝█████╗  ███████║   ██║   \n\
██╔══██║██╔══╝  ██╔══██║██╔══██╗   ██║   ██╔══██╗██╔══╝  ██╔══██║   ██║   \n\
██║  ██║███████╗██║  ██║██║  ██║   ██║   ██████╔╝███████╗██║  ██║   ██║   \n\
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   \n\
                                                                          \n\
")

console.error("\n\
██████╗ ██╗███████╗ ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗\n\
██╔══██╗██║██╔════╝██╔════╝██╔═══██╗████╗  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝\n\
██║  ██║██║███████╗██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║        ██║   \n\
██║  ██║██║╚════██║██║     ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║        ██║   \n\
██████╔╝██║███████║╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║███████╗╚██████╗   ██║   \n\
╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═╝   \n\
                                                                                 \n\
")
*/