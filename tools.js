function httpGet(theUrl)
{
    var xmlHttp = new XMLHttpRequest();
    try {
        xmlHttp.open( "GET", theUrl, false );
        xmlHttp.send(null);

    }
    catch(e) {
        return "CONNECTION_ERROR";
    }
    if(xmlHttp.status == 200)
        return xmlHttp.responseText;
    else if(xmlHttp.status == 404)
        return "NOT_FOUND";
    else
        return "CONNECTION_ERROR";
}

function currentTime() {
	return new Date().getTime() / 1000
}

function url(domain, board, num) {
	return "http://" + domain + "/" + board + "/res/" + num + ".json";
}

function secsToMins(secs) {
	return secs/60;
}

function bind(obj, fun) {
    return function() {
        return fun.apply(obj, arguments);
    };
}

function assert(cond, message) {
    if(!cond)
        throw new Error(message);
}