mysql = require('mysql'),
dbf = require('./gamemaster.dbf-setup.js');
var express=require('express'),
app = express(),
port = process.env.PORT || 1337;

app.use(express.static(__dirname + '/public'));
app.listen(port);

// Performs an SQL query and returns the result in json
var getDBButtons = function(temp)
{
	var sql = "SELECT * FROM till_buttons";
	return dbf.query(mysql.format(sql));	
}

// Takes in json from an previous SQL query and returns it to the client
var processDBButtons = function(rows)
{
	app.get("/buttons",function(req, res)
	{
	  res.send(rows);
	});
}

// Sends, to the client, the current items in the transaction 
var sendTransaction = function()
{
    app.get("/transaction", function(req, res)
    {
		// Promise.resolve will wait until getCurrentTransaction() finishes...
    	var pRes = Promise.resolve(getCurrentTransaction());
		
		// Then once it's finished...
        pRes.then( function (val)
		{
			// ... send the result to the client
			res.send(val);
		});
    });
}

// Gets the current items in the transactions and returns it as json
var getCurrentTransaction = function()
{
	var sql = "SELECT * FROM transaction";
	return dbf.query(mysql.format(sql));
}

// Sends the current items in the transaction back to the client
var processCurrentTransaction = function(rows)
{
	app.get("/list", function(req, res)
	{
		res.send(rows);
	});
}

//Shortcut function so that we don't have to type dbf.query(mysql.format(sql)) each time
var DoQuery = function(sql)
{
	return dbf.query(mysql.format(sql));
}

// Performs an SQL query to get all information about an item with id and returns the result of the query
var getPriceFromID = function(id)
{
	var sql = "SELECT * FROM prices WHERE id = " + id
	return DoQuery(sql);
}

// Adds an item to the current transaction table and returns the result of the query
var addToTransaction = function(rows)
{
	var id = rows[0].id;
	var price = rows[0].price;

	// This line attempts to insert in whatever value and price of an item into the table
	// If it already exists (ON DUPLICATE KEY UPDATE), instead of adding it, it simply updates that row by adding 1 to the quantity
	var sql = "INSERT INTO transaction VALUES (" + id + ", 1, " + price + ") ON DUPLICATE KEY UPDATE quantity = quantity + 1;";

	return Promise.resolve(DoQuery(sql));
}

// Performs an SQL query to get everything from the transaction table and returns it
var refreshTransactionTable = function(rows)
{
	var sql = "SELECT * FROM transaction";
	return Promise.resolve(DoQuery(sql));
}

// A function that handles every time a button is clicked
var onClick = function()
{
	app.get("/click", function(req, res)
	{
		// Get an id from a parameter in the request, which looks like https://www.rj.site/click?id=...
		var id = req.param('id');
		
		// Performs an SQL query getting everything from the inventory table with an id of id
		var sql = "SELECT * FROM inventory WHERE inventory.id = " + id;
		var pResult = DoQuery(sql);
		
		// Once the query is done...
		var clickResolve = Promise.resolve(pResult);
		clickResolve.then(function(val)
		{
			// Perform a series of functions, one after the other, waiting for the previous to finish before moving on
			getPriceFromID(val[0].id).then(addToTransaction).then(refreshTransactionTable).then(function(rows)
			{
				// Finally send back the result of everything (the last being the updated transaction table) to the client
				res.send(rows);
			});

		});
		
	});
}

// As its name implies, it removes ALL of an item from the transaction table
var removeItem = function()
{
	app.get("/remove", function(req, res)
	{
		// Get an id from a parameter in the request, which looks like https://www.rj.site/click?id=...
		var id = req.param('id');
		
		// Performs an SQL query to remove a row from transaction with a given id
		var sql = "DELETE FROM transaction WHERE id = " + id;
		var pResult = DoQuery(sql);
		
		// When the query finishes...
		var pResolve = Promise.resolve(pResult);
		pResolve.then(refreshTransactionTable).then(function(rows)
		{
			//... send the result back to the client
			res.send(rows);
		});;
		
	});
}

//Enable our 'listeners'
onClick();
removeItem();
sendTransaction();
getCurrentTransaction().then(processCurrentTransaction);
getDBButtons().then(processDBButtons);








