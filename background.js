var Settings = {
    minimumDelay: 10,
    maximumPeriod: 600,
    factor: 1.5,
    domain: "2ch.hk",
    count_threads: true
};

var MonitorData = {
    threadsMap: Immutable.Map({}),
    debug: true
};

var Monitor = {
    log: function (msg) {
        if(MonitorData.debug)
            console.log(msg)
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

            if(!_.isUndefined(savedData.dvachmon))
                Threads.loadFromObjects(savedData.dvachmon.threads);
            else
                Threads.loadFromObjects({});

            func(Threads.getAll());
        });
    }
};

(function(){
    Monitor.log("started");
    chrome.browserAction.setBadgeText({text: '0'});

    Storage.load(function(threads){
        Monitor.log("Data loaded from local storage " + threads);

        var stupidFuckingJavascript = threads.toObject();

        for(var k in stupidFuckingJavascript){
            if(stupidFuckingJavascript.hasOwnProperty(k))
                Updater.runMonitoring(Threads.getThread(k), 0);
        }

        initListener();
    });
})();

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

var Threads = {
    /** @returns {Immutable.Map}*/
    getThread: function (num) {
        return MonitorData.threadsMap.get(num.toString());
    },

    deleteThread: function (num) {
        MonitorData.threadsMap = MonitorData.threadsMap.delete(num.toString());
        Storage.saveThreads();
    },

    /**
     * Возвращает треды в виде Immutable.Map
     * @returns {Immutable.Map}*/
    getAll: function() {
        return MonitorData.threadsMap;
    },

    /** Возвращает треды в виде js-объекта
     * @returns {Object}*/
    getAllAsObjects: function() {
        return MonitorData.threadsMap.map(function(threadMap) { return threadMap.toObject(); }).toObject();
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

        MonitorData.threadsMap = MonitorData.threadsMap.set(thread.get("num").toString(), thread);

        Storage.saveThreads();

        return thread;
    },

    /** @returns {Boolean}*/
    has: function(num) {
        // return (num in MonitorData.threads);
        return MonitorData.threadsMap.has(num.toString());
    },

    loadFromObjects: function(threadsObject) {
        MonitorData.threadsMap = Immutable.fromJS(threadsObject);
        updateCounter();
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
            delay: Settings.minimumDelay,   // предыдущая задержка
            not_found_errors: 0,            // количество ошибок 404
            errors: 0                       // количество ошибок соединения
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

        var resp = httpGet(url(Settings.domain, thread.board, thread.num));

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
     * Цикл отменяется при помочи Scheduler.unscheduleTask(num)
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
                var applied = self.applyResultToThread(threadMap, checkResult);

                if(checkResult.unread > 0) {
                    self.runMonitoring(
                        Threads.pushThread (
                            applied.set("delay", Settings.minimumDelay)
                        ), Settings.minimumDelay);

                    updateCounter();

                } else {    // иначе запускаем с увеличенной задержкой

                    var newDelay = self.getUpdateDelay(_.isUndefined(delay) ? Settings.minimumDelay : delay);

                    assert(!_.isNaN(newDelay), "ebal ruka");

                    self.runMonitoring(
                        Threads.pushThread(applied.set("delay", newDelay)),
                        newDelay
                    );
                }

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


/**
 * Обработчик сообщений
 * */
function initListener() {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {

              if (!request.type) return;

              Monitor.log(request);

              switch(request.type) {
                case "thread-added":

                    var threadData = request.data;

                    var thread = Threads.pushThread(
                        Threads.createThread(
                            threadData.num,
                            threadData.board,
                            threadData.title,
                            threadData.last_post
                        )
                    );

                    // если добавлено с главной, то начинаем мониторить
                    // иначе юзер сидит в треде и мониторить его смысла нет
                    if(threadData.from_main)
                        Updater.runMonitoring(thread);
                break;

                case "thread-removed":

                    Monitor.log("removed");
                    if(Threads.has(request.data.num)) {
                        Monitor.log("removing " + request.data.num);
                        Scheduler.unscheduleTask(request.data.num);
                        Threads.deleteThread(request.data.num);
                        updateCounter();
                    }

                break;

                /**
                 * Если битард вернулся во вкладку, то отмечаем ее как прочитанную и перестаем мониторить
                 * */

                case "window-focused":
                    Monitor.log("focused");
                    if(Threads.has(request.data.threadId)) {
                        Scheduler.unscheduleTask(request.data.threadId);

                        Threads.pushThread(
                            Threads.markThreadAsRead(
                                Threads.getThread(request.data.threadId),
                                request.data.last_post)
                        );
                        updateCounter();
                    }
                break;

                /**
                 * Если битард свернул вкладку, то отмечаем ее как прочитанную и начинаем мониторить
                 * */

                case "window-blured":
                    Monitor.log("unfocused");
                    if(Threads.has(request.data.threadId)) {
                        Scheduler.unscheduleTask(request.data.threadId);
                        Updater.runMonitoring(
                            Threads.pushThread(
                                Threads.markThreadAsRead(
                                    Threads.getThread(request.data.threadId),
                                    request.data.last_post
                                )
                            )
                        );

                    }
                break;

                /**
                 * Если битард открыл страницу, то отмечаем ее как прочитанную и перестаем мониторить
                 * */
                case "thread-loaded":
                    Monitor.log("loaded");

                    if(Threads.has(request.data.threadId)) {
                        Scheduler.unscheduleTask(request.data.threadId);

                        Threads.pushThread(
                            Threads.markThreadAsRead(
                                Threads.getThread(request.data.threadId),
                                request.data.last_post)
                        );
                        updateCounter();
                    }
                break;

                /**
                 * Если битард закрыл страницу, то отмечаем ее как прочитанную и начинаем мониторить этот тред
                 * */
                case "window-unload":
                    Monitor.log("unloaded");
                    if(Threads.has(request.data.threadId)) {
                        Scheduler.unscheduleTask(request.data.threadId);
                        Updater.runMonitoring(
                            Threads.pushThread(
                                Threads.markThreadAsRead(
                                    Threads.getThread(request.data.threadId),
                                    request.data.last_post)
                            )
                        );

                    }
                break;

                /**
                 * Подгружает избранное с двоща. Добавляет только то, чего еще нет в Threads
                 * */
                case "storage-favorites":
                    Monitor.log("storage-favorites");
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

                    Monitor.log(newFavsNums);
                break;

                /**
                 * реквесты из popup.html
                 * */
                case "popup-request":
                    Monitor.log("Got popup-request");
                    sendResponse({threads: Threads.getAllAsObjects()});
                break;

                case "popup-markasread":

                    Monitor.log("Got popup-markasread");
                    var num = request.data.num;

                    if(Threads.has(num)) {
                        Scheduler.unscheduleTask(num);

                        Updater.runMonitoring(
                            Threads.pushThread(
                                Threads.markThreadAsRead(
                                    Updater.getUpdatedThread(
                                        Threads.getThread(num)
                                    ))),
                            Threads.getThread(num).get("delay")
                        );

                        updateCounter();
                        sendResponse({threads: Threads.getAllAsObjects()});
                    }


                break;

                case "popup-update":

                    Monitor.log("popup-update");
                    var num = request.data.num;

                    if(Threads.has(num)) {
                        Scheduler.unscheduleTask(num);
                        Updater.runMonitoring(
                            Threads.pushThread(
                                    Updater.getUpdatedThread(
                                        Threads.getThread(num)
                                    )),
                            Threads.getThread(num).get("delay")
                        );
                        updateCounter();
                        sendResponse({threads: Threads.getAllAsObjects()})
                    }

                break;

              case "popup-update-all":

                  Monitor.log("popup-update-all");

                  var threads = Threads.getAllAsObjects();

                  for(num in threads) {
                        if(threads.hasOwnProperty(num) && Threads.has(num)) {
                            Scheduler.unscheduleTask(num);
                            Updater.runMonitoring(
                                Threads.pushThread(
                                    Updater.getUpdatedThread(
                                        Threads.getThread(num)
                                    )),
                                Threads.getThread(num).get("delay")
                            );
                        }
                  }
                  updateCounter();
                  sendResponse({threads: Threads.getAllAsObjects()});

              break;
            }

        }
    )
}

function updateCounter() {
    var threads = Threads.getAllAsObjects();
    var totalUnreads = 0;

    for(var key in threads) {
        if(threads.hasOwnProperty(key)) {
            totalUnreads += Settings.count_threads ? (threads[key].unread > 0 ? 1 : 0) : threads[key].unread;
        }
    }

    chrome.browserAction.setBadgeText({text: totalUnreads > 0 ? totalUnreads.toString(): ''});
}