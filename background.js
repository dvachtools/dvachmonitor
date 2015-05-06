var Settings = {
    minimumDelay: 10,
    maximumPeriod: 600,
    factor: 1.5,
    domain: "2ch.hk",
    count_threads: true
};

var MonitorData = {
    //threadsMap: Immutable.Map({}),
    debug: true
};

var Monitor = {
    log: function (msg) {
        if(MonitorData.debug) {
            //console.log(stackTrace());
            console.log(msg)
        }
    }
};

var Storage = {
    saveThreads: function() {
        chrome.storage.local.set(
            {
                "dvachmon": {
                    settings: Settings,
                    threads: Threads.getAllAsObjects()
                }
            },
            function(){
                Monitor.log("saved to the storage");
            });
    },

    load: function( func ) {
        chrome.storage.local.get("dvachmon", function(savedData) {

            Monitor.log(savedData);

            var threads;

            if(!_.isUndefined(savedData.dvachmon))
                threads = ThreadsProto.loadFromObjects(savedData.dvachmon.threads);
            else
                threads = ThreadsProto.loadFromObjects({});

            func(threads);
        });
    }
};

var Scheduler = {

    listeners: {},

    addListener: function(num, listener) {
        if (_.isUndefined(this.listeners[num])) {
            this.listeners[num] = [];
        }

        this.listeners[num].push(listener);
        chrome.alarms.onAlarm.addListener(listener);
    },

    clearListeners: function(num) {
        if(_.isUndefined(this.listeners[num])) {
            this.listeners[num] = [];
        } else {
            for (var i = 0; i < this.listeners[num].length; i++) {
                Monitor.log("removing " + num + " listener " + i);
                chrome.alarms.onAlarm.removeListener(this.listeners[num][i]);
            }

            this.listeners[num] = [];
        }
    },

    unscheduleTask: function (num) {
        Monitor.log("Unscheduling " + num);
        this.clearListeners(num);
        chrome.alarms.clear(num.toString(), function(wc){})
    },

    scheduleTask: function (num, func, delaySecs) {
        Monitor.log("a task for " + num + " scheduled after " + secsToMins(delaySecs) + "minutes");

        chrome.alarms.create(
            num.toString(), {
                'delayInMinutes': secsToMins(delaySecs)
            });

        var self = this;

        var listener = function(alarm) {
            if (alarm.name == num.toString()) {
                self.clearListeners(num);
                func();
            }
        };

        this.addListener(num, listener);
    }
};

var ThreadsProto = {
    threadsMap: Immutable.Map({}),

    /** @returns {ThreadsProto}*/
    fromThreadsMap: function(tmap) {
        var copy = _.clone(this);
        copy.threadsMap = tmap;
        return copy;
    },

    /** @returns {Immutable.Map}*/
    getThread: function (num) {
        return this.threadsMap.get(num.toString());
    },

    /** @returns {ThreadsProto}*/
    deleteThread: function (num) {
        return this.fromThreadsMap(this.threadsMap.delete(num.toString()));
        //Storage.saveThreads();
    },

    /**
     * Возвращает треды в виде Immutable.Map
     * @returns {Immutable.Map}*/
    getAll: function() {
        return this.threadsMap;
    },

    /** Возвращает треды в виде js-объекта
     * @returns {ThreadsProto}*/
    getAllAsObjects: function() {
        return this.threadsMap.map(function(threadMap) { return threadMap.toObject(); }).toObject();
    },

    /**
     * Сохраняет и возвращает тред. Единственная функция, сохраняющая тред
     * @returns {Immutable.Map}
     * @param {Immutable.Map} thread
     * */
    pushThread: function(thread) {

        if(_.isUndefined(thread)) {
            throw new Error("Pushing undefined");
        }

        return this.fromThreadsMap(this.threadsMap.set(thread.get("num").toString(), thread));
    },

    /** @returns {Boolean}*/
    has: function(num) {
        // return (num in MonitorData.threads);
        return this.threadsMap.has(num.toString());
    },

    /** @returns {ThreadsProto}*/
    loadFromObjects: function(threadsObject) {
        //updateCounter();
        return this.fromThreadsMap(Immutable.fromJS(threadsObject));
    },

    /**
     * Создает тред в виде Immutable.Map
     * @returns {Immutable.Map}*/
    createThread: function (num, board, title, last_post) {

        var thread = Immutable.Map({
            num: num.toString(),            // id треда
            board: board,                   // доска
            title: title,
            last_post: last_post,           // последний пост в треде
            last_update: currentTime(),
            first_unread: last_post,        // первый непрочитанный пост
            unread: 0,                      // количество непрочитанных постов
            delay: Settings.minimumDelay,   // предыдущая задержка перед обновлением
            not_found_errors: 0,            // количество ошибок 404
            errors: 0,                       // количество ошибок соединения
            is_monitored: true
        });

        Monitor.log("a new data received " + JSON.stringify(thread));

        return thread;
    },

    /**
     * Возвращает тред помеченным как прочитанный
     * @param {Immutable.Map} threadMap
     * @param {number=} last_post
     * @returns {Immutable.Map}
     * */
    markThreadAsRead: function (threadMap, last_post) {

        if(_.isUndefined(threadMap))
            throw new Error("Got undefined in undefined undefined");

        if(threadMap.get("errors") == 0 && threadMap.get("not_found_errors") == 0)
            if(_.isUndefined(last_post))
                return threadMap.set("unread", 0);
            else
                return threadMap.set("unread", 0).set("last_post", last_post).set("first_unread", last_post);
        else
            return threadMap
    }
};

/**
 * Занимается проверкой обновлений
 * */
var Updater = {

    /**
     * Возвращает задержку перед следующей проверкой
     * @param {number} previousDelay предыдущая задержка */
    getUpdateDelay: function(previousDelay) {

        if(_.isNaN(previousDelay))
            throw new Error("This wonderful javascript world");

        var d = previousDelay * Settings.factor;

        if(d < Settings.minimumDelay)
            return Settings.minimumDelay;
        else if(d > Settings.maximumPeriod)
            return Settings.maximumPeriod;
        else
            return d;
    },

    /**
     * проверяет обновления для треда, возвращает объект result
     * @returns {Object}
     * @param {Immutable.Map} threadMap
     * */
    getUpdates: function(threadMap) {

        assert(!_.isUndefined(threadMap), "welcome to undefined world");

        var thread = threadMap.toObject();

        var resp = httpGet(url(Settings.domain, thread.board, thread.num)); // получаем json треда

        if(resp == "CONNECTION_ERROR" || _.isUndefined(resp)) {
            return {unread: -1, last_post: -1, not_found: false, error: true};
        } else if (resp == "NOT_FOUND") {
            return {unread: -1, last_post: -1, not_found: true, error: false};
        } else {

            var newData = JSON.parse(resp);

            var newPostsCount = 0;
            var first_unread = 0;

            if (newData.max_num != thread.last_post) {
                var newPosts = _.filter(
                    newData.threads[0].posts,
                    function (post) {
                        return (post.num > thread.last_post);
                    });

                newPostsCount = newPosts.length;
                first_unread = newPosts[0].num; // первый непрочитанный из новых (!) непрочитанных
            }

            Monitor.log("thread: " + thread.num + ", unread:" + newPostsCount + ", new last_post: " + newData.max_num + ",  thread.last_post: " +  thread.last_post);

            return {
                unread: newPostsCount,          // количество новых постов с последней проверки
                last_post: newData.max_num,     // последний пост
                first_unread: first_unread,     // номер первого непрочитанного поста среди новых
                not_found: false,               // тред удален
                error: false                    // ошибка HTTP
            };
        }
    },

    /**
     * запускает рекурсивный цикл обновлений
     * Цикл отменяется при помочи Scheduler.unscheduleTask(thread_num)
     * @param {Immutable.Map} threadMap
     * @param {number=} delay задержка перед проверкой, по умолчанию Settings.minimumDelay
     * */
    runMonitoring: function(threadMap, delay) {
        var self = this;

        Monitor.log("scheduling " + threadMap.get('num') + " after " + delay);

        Scheduler.scheduleTask(
            threadMap.get('num'),
            function() {

                var checkResult = self.getUpdates(threadMap);
                MainActor.receive("thread-checked", {thread: threadMap, result: checkResult, delay: delay});
                /*var applied = self.applyResultToThread(threadMap, checkResult); // новый объект треда

                if(checkResult.unread > 0) {
                    self.runMonitoring(
                        Threads.pushThread (
                            applied.set("delay", Settings.minimumDelay) // если есть новые сообщения, то следующая
                            // проверка будет через минимальное кол-во времени
                        ), Settings.minimumDelay);

                    updateCounter();

                } else {    // иначе запускаем с увеличенной задержкой

                    var newDelay = self.getUpdateDelay(_.isUndefined(delay) ? Settings.minimumDelay : delay);

                    assert(!_.isNaN(newDelay), "ebal ruka");

                    self.runMonitoring(
                        Threads.pushThread(applied.set("delay", newDelay)),
                        newDelay
                    );
                }*/

            },
            _.isUndefined(delay) ? Settings.minimumDelay : delay
        )},

    /**
     * применяет результат функции getUpdates к треду
     * @return {Immutable.Map}
     * @param {Immutable.Map} threadMap
     * @param {object} result
     * @param {number} result.unread
     * @param {number} result.last_post
     * */
    applyResultToThread: function (threadMap, result) {

        if(result.not_found) {
            return threadMap.set("not_found_errors", threadMap.get("not_found_errors") + 1);
        } else if(result.error) {
            return threadMap.set("errors", threadMap.get("errors") + 1);
        } else if(result.unread > 0) {
            return threadMap.
                    set("first_unread", (threadMap.get("unread") == 0 ? result.first_unread : threadMap.get("first_unread"))).
                    set("unread", threadMap.get("unread") + result.unread).
                    set("last_update", currentTime()).
                    set("errors", 0).
                    set("not_found_errors", 0).
                    set("last_post", result.last_post);
        } else {
            return threadMap.set("errors", 0).set("not_found_errors", 0);
        }
    },

    getUpdatedThread: function(threadMap) {
        return this.applyResultToThread(
            threadMap,
            this.getUpdates(threadMap)
        );
    }
};


var MainActor = {
    receive: actorReceive(ThreadsProto, {tabs: []}),

    become: function(newReceive) {
        this.receive = newReceive
    },

    stateAddTab: function(state, windowId, tabId, threadData) {
        state = this.stateRemoveTab(state, windowId, tabId);
        state.tabs = state.tabs.concat([{windowId: windowId, tabId: tabId, threadData: threadData}]);
        return state
    },

    stateRemoveTab: function(state, windowId, tabId) {
        state.tabs = _.without(state.tabs, _.findWhere(state.tabs, {windowId: windowId, tabId: tabId}));
        return state;
    }
};

(function(){
    Monitor.log("started");
    chrome.browserAction.setBadgeText({text: ''});

    Storage.load(function(threads){
        Monitor.log("Data loaded from local storage " + threads);

        MainActor.receive("restore-storage", threads, function() {

            chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
                if (changeInfo.status == 'complete') {
                    MainActor.receive("update-tab", {tabId: tabId});
                }
            });

            initListener();
        });

    });
})();

function actorReceive(threads, state) {
    assert(!_.isUndefined(threads), "Oh hai");

    return function(messageId, messageData, responseCallback) {

        assert(!_.isUndefined(threads), "Oh hai x 2");

        Monitor.log(state);

        //responseCallback = (_.isNaN(responseCallback))? function(){}: responseCallback;

        switch(messageId) {
            case "restore-storage":

                threads = messageData;

                var stupidFuckingJavascript = threads.getAll().toObject();

                for(var k in stupidFuckingJavascript){
                    if(stupidFuckingJavascript.hasOwnProperty(k))
                        if(threads.getThread(k).get("is_monitored"))
                            Updater.runMonitoring(threads.getThread(k), 0);
                        else {
                            if(_.isUndefined(threads.getThread(k).get("is_monitored"))) {
                                threads = threads.pushThread(threads.getThread(k).set("is_monitored", true));
                                Updater.runMonitoring(threads.getThread(k), 0);
                            }
                        }
                }

                MainActor.become(actorReceive(threads, state));

                MainActor.receive("update-content-script");

                responseCallback();

                break;

            case "thread-checked":

                var threadMap = messageData.thread;
                var checkResult = messageData.result;
                var delay = messageData.delay;

                var applied = Updater.applyResultToThread(threadMap, checkResult); // новый объект треда

                 if(checkResult.unread > 0) {

                     thread = applied.set("delay", Settings.minimumDelay); // если есть новые сообщения, то следующая
                     // проверка будет через минимальное кол-во времени
                     threads = threads.pushThread(thread);

                     Updater.runMonitoring(thread, Settings.minimumDelay);

                     updateCounter(threads);

                 } else {    // иначе запускаем с увеличенной задержкой

                     var newDelay = Updater.getUpdateDelay(_.isUndefined(delay) ? Settings.minimumDelay : delay);

                     assert(!_.isNaN(newDelay), "ebal ruka");

                     thread = applied.set("delay", newDelay);
                     threads = threads.pushThread(thread);

                     Updater.runMonitoring(thread, newDelay);
                 }

                MainActor.become(actorReceive(threads, state));

                break;

            case "window-focused":

                Monitor.log("focused");

                if(threads.has(messageData.threadId)) {
                    Scheduler.unscheduleTask(messageData.threadId);

                    threads = threads.pushThread(
                        threads.markThreadAsRead(
                            threads.getThread(messageData.threadId),
                            messageData.last_post)
                    );

                    updateCounter(threads);
                }

                MainActor.become(actorReceive(threads, state));

                break;

            case "window-blured":

                Monitor.log("unfocused");
                if(threads.has(messageData.threadId)) {
                    Scheduler.unscheduleTask(messageData.threadId);

                    threads = threads.pushThread(
                        threads.markThreadAsRead(
                            threads.getThread(messageData.threadId),
                            messageData.last_post
                        )
                    );

                    updateCounter(threads);

                    if(threads.getThread(messageData.threadId).get("is_monitored"))
                        Updater.runMonitoring(threads.getThread(messageData.threadId));
                }

                MainActor.become(actorReceive(threads, /*{thread_opened: false}*/state));

                break;

            case "thread-loaded":

                Monitor.log("loaded");

                var sender = messageData[0];
                var threadData = messageData[1];

                if(threads.has(threadData.threadId)) {
                    Scheduler.unscheduleTask(threadData.threadId);

                    threads = threads.pushThread(
                        threads.markThreadAsRead(
                            threads.getThread(threadData.threadId),
                            threadData.last_post)
                    );
                    updateCounter(threads);
                }

                state = MainActor.stateAddTab(state, sender.tab.windowId, sender.tab.id, threadData);

                MainActor.become(actorReceive(threads, state));

                break;

            case "window-unload":

                sender = messageData[0];
                threadData = messageData[1];

                Monitor.log("unloaded");
                if(threads.has(threadData.threadId)) {
                    Scheduler.unscheduleTask(threadData.threadId);
                    threads = threads.pushThread(
                        threads.markThreadAsRead(
                            threads.getThread(threadData.threadId),
                            threadData.last_post)
                    );

                    updateCounter(threads);
                    MainActor.become(actorReceive(threads, state));

                    if(threads.getThread(threadData.threadId).get("is_monitored"))
                        Updater.runMonitoring(threads.getThread(threadData.threadId));
                }

                state = MainActor.stateRemoveTab(state, sender.tab.windowId, sender.tab.id);

                MainActor.become(actorReceive(threads, state));

                break;

            case "storage-favorites":
                break;

            case "add-thread":

                threads = threads.pushThread(
                    threads.createThread(
                        messageData.threadId,
                        messageData.board,
                        messageData.title,
                        messageData.last_post
                ));

                updateCounter(threads);

                if(!_.isUndefined(messageData.from_main) && messageData.from_main)
                    Updater.runMonitoring(threads.getThread(messageData.threadId));

                MainActor.become(actorReceive(threads, state));
                MainActor.receive("popup-request", {}, responseCallback);
                break;

            case "add-current-thread":

/*                if(state.thread_opened && !threads.has(state.current_thread.threadId)) {
                    MainActor.receive("add-thread", state.current_thread, responseCallback);
                } else {
                    Monitor.log("No current thread :(");
                    responseCallback(threads, state);
                }*/

                MainActor.receive("popup-request", {}, function(thds, current){
                    if(current.addable) {
                        MainActor.receive("add-thread", current.threadData, responseCallback);
                    } else {
                        responseCallback(thds, current);
                    }
                });

                break;

            case "remove-thread":

                Monitor.log("remove-thread");

                if(threads.has(messageData.threadId)) {
                    Monitor.log("removing " + messageData.threadId);

                    Scheduler.unscheduleTask(messageData.threadId);
                    threads = threads.deleteThread(messageData.threadId);
                    updateCounter(threads);
                    MainActor.become(actorReceive(threads, state));
                }
                //responseCallback(threads, state);
                MainActor.receive("popup-request", {}, responseCallback);

                break;

            case "popup-request":
                chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function(tabs) {
                    console.log(tabs); //test, prints one-element array as expected
                    console.log(state.tabs);
                    if(tabs.length > 0) {
                        var x = {
                            windowId: tabs[0].windowId,
                            tabId: tabs[0].id
                        };

                        var currentThread = _.findWhere(state.tabs, x);

                        if(_.isUndefined(currentThread))
                            responseCallback(threads, {addable: false});
                        else
                            responseCallback(threads, {addable: !threads.has(currentThread.threadData.threadId), threadData: currentThread.threadData});
                    } else {
                        responseCallback(threads, {addable: false});
                    }
                });
                break;

            case "popup-markasread":

                Monitor.log("Got popup-markasread");
                var threadId = messageData.threadId;

                if(threads.has(threadId)) {
                    Scheduler.unscheduleTask(threadId);


                    threads = threads.pushThread(
                        threads.markThreadAsRead(
                            Updater.getUpdatedThread(
                                threads.getThread(threadId)
                            )));

                    if(threads.getThread(threadId).get("is_monitored"))
                        Updater.runMonitoring(threads.getThread(threadId), threads.getThread(threadId).get("delay"));

                    updateCounter(threads);
                    MainActor.receive("popup-request", {}, responseCallback);
                }

                break;

            case "popup-update-all":

                Monitor.log("popup-update-all");

                var threadsMap = threads.getAllAsObjects();

                for(var num in threadsMap) {
                    if(threadsMap.hasOwnProperty(num) && threads.has(num)) {
                        Scheduler.unscheduleTask(num);

                        threads = threads.pushThread(
                            Updater.getUpdatedThread(
                                threads.getThread(num)
                            )
                        );

                        if(threads.getThread(num).get("is_monitored"))
                            Updater.runMonitoring(
                                threads.getThread(num),
                                threads.getThread(num).get("delay")
                            );
                    }
                }

                updateCounter(threads);
                MainActor.become(actorReceive(threads, state));
                MainActor.receive("popup-request", {}, responseCallback);

                break;

            case "update-tab":

                chrome.tabs.sendMessage(messageData.tabId, threads.getAll().toObject());

                break;

            case "update-content-script":

                chrome.tabs.query({}, function(tabs) {
                    for (var i=0; i<tabs.length; ++i) {
                        chrome.tabs.sendMessage(tabs[i].id, threads.getAll().toObject());
                    }
                });

                break;

            case "stop-monitoring":

                threadId = messageData.threadId;

                if(threads.has(threadId)) {
                    Scheduler.unscheduleTask(threadId);
                    threads = threads.pushThread(threads.getThread(threadId).set('is_monitored', false));
                }

                MainActor.become(actorReceive(threads, state));
                MainActor.receive("popup-request", {}, responseCallback);

                break;

            case "start-monitoring":

                threadId = messageData.threadId;

                if(threads.has(threadId)) {
                    Scheduler.unscheduleTask(threadId);
                    threads = threads.pushThread(threads.getThread(threadId).set('is_monitored', true));
                    Updater.runMonitoring(threads.getThread(threadId));
                }

                MainActor.become(actorReceive(threads, state));
                MainActor.receive("popup-request", {}, responseCallback);

                break;
        }
    }
}

/**
 * Обработчик сообщений от попапа и контент-скрипта
 * */
function initListener() {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {

              if (!request.type) return;

              console.log(request, sender);

              switch(request.type) {

                /**
                 * Если битард вернулся во вкладку, то отмечаем ее как прочитанную и перестаем мониторить
                 * */

                case "window-focused":
                    Monitor.log("focused");
                    MainActor.receive("window-focused", request.data);
                break;

                /**
                 * Если битард свернул вкладку, то отмечаем ее как прочитанную и начинаем мониторить
                 * */

                case "window-blured":
                    Monitor.log("unfocused");
                    MainActor.receive("window-blured", request.data);
                break;

                /**
                 * Если битард открыл страницу, то отмечаем ее как прочитанную и перестаем мониторить
                 * */
                case "thread-loaded":
                    Monitor.log("loaded");

                    MainActor.receive("thread-loaded", [sender, request.data]);
                break;

                /**
                 * Если битард закрыл страницу, то отмечаем ее как прочитанную и начинаем мониторить этот тред
                 * */
                case "window-unload":
                    Monitor.log("unloaded");
                    MainActor.receive("window-unload", [sender, request.data]);
                break;

                /**
                 * Подгружает избранное с двоща. Добавляет только то, чего еще нет в Threads
                 * */
                case "storage-favorites":
/*                    Monitor.log("storage-favorites");
                    Monitor.log(request.data);

                    var favs = request.data;

                    var newFavsNums = _.filter(
                        Object.keys(favs),
                        function(key) {
                            return !Threads.has(key) && !(favs[key].title == undefined);
                        });

                    _.forEach(newFavsNums, function(num){
                        var fav = favs[num];
                        Updater.runMonitoring(
                            Threads.pushThread(
                                Threads.createThread(num, fav.board, fav.title, fav.last_post)
                            ),
                            0
                        );
                    });

                    Monitor.log(newFavsNums);*/
                break;

              /**
               *  реквесты из hook.js
               *  */
              case "thread-added":
                  MainActor.receive("add-thread", request.data, function(thds, state){});
                  break;

              case "thread-removed":
                  MainActor.receive("remove-thread", request.data, function(thds, state){});

                  break;

                /**
                 * реквесты из popup.html
                 * */

              case "popup-markasread":
                MainActor.receive("popup-markasread", request.data, function(thds, state) {
                    sendResponse({threads: thds.getAllAsObjects(), state: state});
                });
                break;

              case "stop-monitoring":
                  MainActor.receive("stop-monitoring", request.data, function(thds, state) {
                      sendResponse({threads: thds.getAllAsObjects(), state: state});
                  });
                  break;

              case "start-monitoring":
                  MainActor.receive("start-monitoring", request.data, function(thds, state) {
                      sendResponse({threads: thds.getAllAsObjects(), state: state});
                  });
                  break;

              case "popup-request":
                  Monitor.log("Got popup-request");

                  MainActor.receive("popup-request", {}, function(thds, state) {
                      console.log(sendResponse);
                      sendResponse({threads: thds.getAllAsObjects(), state: state});
                  });
                  break;

              case "add-current-thread":

                  Monitor.log("Got add-current-thread");
                  MainActor.receive("add-current-thread", {}, function(thds, state){
                      sendResponse({threads: thds.getAllAsObjects(), state: state});
                  });

                  break;

              case "remove-thread":

                  Monitor.log("Got remove-thread");
                  MainActor.receive("remove-thread", request.data, function(thds, state){
                      sendResponse({threads: thds.getAllAsObjects(), state: state});
                  });


                  break;

              case "popup-update-all":

                  Monitor.log("popup-update-all");

                  MainActor.receive(
                      "popup-update-all",
                      {},
                      function(ths, state) {
                          sendResponse({threads: ths.getAllAsObjects(), state: state});
                      }
                  );

              break;
            }

            return true;
        }
    )
}

function updateCounter(threads) {

    MainActor.receive("update-content-script");

    threads = threads.getAllAsObjects();
    var totalUnreads = 0;

    for(var key in threads) {
        if(threads.hasOwnProperty(key)) {
            totalUnreads += Settings.count_threads ? (threads[key].unread > 0 ? 1 : 0) : threads[key].unread;
        }
    }

    chrome.browserAction.setBadgeText({text: totalUnreads > 0 ? totalUnreads.toString(): ''});
}