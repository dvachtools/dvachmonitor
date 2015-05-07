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

phonecatApp.directive('ngHoverKeydown', ['$document', function ($document) {
    return {
        restrict: 'A',
        scope: {method: '&ngHoverKeydown'},

        link: function ($scope, element, attrs) {

            var expressionHandler = $scope.method();

            element.bind("mouseover", function (event) {
                $document.bind("keypress", function (event) {
                    expressionHandler(event.which);
                });
            });

            element.bind("mouseout", function (event) {
                $document.unbind("keypress");
            });

        }
    };
}]);

phonecatApp.controller('threadsListCtrl', function ($scope, $document) {

    $scope.threads = {};
    $scope.state = {};
    $scope.checkingAll = false;

    $scope.linkKeyPress = function(threadId) {
        return function(key) {
            switch(key) {
                case 13:
                    $scope.markThreadAsRead(threadId);
                    break;
                case 127:
                    $scope.deleteThread(threadId);
                    break;
                case 32:
                    $scope.toggleMonitoring(threadId);
                    break;
            }
        }
    };

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
        $scope.checkingAll = true;
        $scope.$apply();
        chrome.runtime.sendMessage({ type: "popup-update-all" }, function(response) {
            $scope.checkingAll = false;
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

    $scope.toggleMonitoring = function(threadId) {
        chrome.runtime.sendMessage({ type: "toggle-monitoring", data: {threadId: threadId} }, function(response) {
            $scope.update(response.threads, response.state);
        });
    };

    $scope.importFavorites = function(){
        chrome.runtime.sendMessage({ type: "import-favorites"}, function(response) {
            $scope.update(response.threads, response.state);
        });
    };

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if(request.type && request.type == "push-to-popup" && request.data) {
                $scope.update(request.data.threads, request.data.state);
            }
        });

    $scope.updateView();


});