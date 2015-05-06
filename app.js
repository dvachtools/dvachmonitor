var phonecatApp = angular.module('threadsApp', []);

phonecatApp.filter("toArray", function(){
    return function(obj) {
        var result = [];
        angular.forEach(obj, function(val, key) {
            result.push(val);
        });
        return result;
    };
});

phonecatApp.controller('threadsListCtrl', function ($scope) {

    $scope.threads = {};
    $scope.state = {};

    $scope.update = function(threads, state) {
        $scope.threads = threads;
        $scope.state = state;
        $scope.$apply();
    };

    $scope.updateView = function() {
        chrome.runtime.sendMessage({ type: "popup-request" }, function(data) {

            console.log("Got popup-response");
            console.log(data.state);
            console.log(data.threads);

            $scope.update(data.threads, data.state);
        });
    };

    $scope.checkAllThreads = function() {
        chrome.runtime.sendMessage({ type: "popup-update-all" }, function(response) {
            $scope.update(response.threads, response.state);
        });
    };

    $scope.markThreadAsRead = function(threadId) {

        chrome.runtime.sendMessage({ type: "popup-markasread", data: {threadId: threadId} }, function(response) {
            $scope.update(response.threads, response.state);
        });

    };

    $scope.deleteThread = function(threadId) {
        chrome.runtime.sendMessage({ type: "remove-thread", data: {threadId: threadId }}, function(response){
            $scope.update(response.threads, response.state);
        });
    };

    $scope.addCurrentThread = function() {
        chrome.runtime.sendMessage({ type: "add-current-thread" }, function(response){
            $scope.update(response.threads, response.state);
        });
    };

    $scope.stopMonitoring = function(threadId) {
        chrome.runtime.sendMessage({ type: "stop-monitoring", data: {threadId: threadId} }, function(response) {
            $scope.update(response.threads, response.state);
        });
    };

    $scope.startMonitoring = function(threadId) {
        chrome.runtime.sendMessage({ type: "start-monitoring", data: {threadId: threadId} }, function(response) {
            $scope.update(response.threads, response.state);
        });
    };

    $scope.updateView();


});