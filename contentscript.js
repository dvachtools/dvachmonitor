/* console.log("Content script");
 console.log(window.localStorage["store"]);
*/
var s = document.createElement('script');

s.src = chrome.extension.getURL('hook.js');
s.onload = function() {
    this.parentNode.removeChild(this);
};
(document.head||document.documentElement).appendChild(s);


var port = chrome.runtime.connect();

window.addEventListener("message", function(event) {

  	if (event.source != window)
    	return;

	if (event.data.type && (event.data.type == "thread-added")) {
    	console.log("User added thread: " + event.data.data);
  	}	

	if (event.data.type && (event.data.type == "thread-removed")) {
    	console.log("User removed thread: " + event.data.data);
  	}

	chrome.runtime.sendMessage(event.data);

}, false);