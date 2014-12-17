$(function(){
    chrome.runtime.sendMessage({ type: "popup-request" }, function(response) {

        console.log("Got popup-response");
        console.log(response);

        render(response.threads);
    });

    var div_default_content =  $('#links-div').html();

    function render(threads) {
        var sorted = _.sortBy(threads, function(thread) { return -thread.unread; });

        var content_div = $('#links-div');

        if(sorted.length  == 0) {
            content_div.html(div_default_content);

        } else {

            content_div.empty();

            renderLinks(sorted);

            $('.read-btn').on('click', function () {
                $(this).attr('src', 'images/ok_pending.png');
                markAsRead($(this).attr('thread-id'));
            });

            $('.update-btn').on('click', function () {
                $(this).attr('src', 'images/reload_pending.png');
                updateThread($(this).attr('thread-id'));
            });

            $('.update-all-btn').on('click', function () {
                $(this).attr('src', 'images/reload_pending.png');
                updateAll();
            });
        }

        $('.thread-link').on('click', function () {
            chrome.tabs.create({url: $(this).attr('href')});
            return false;
        });

    }

    function markAsRead(num) {
        console.log("markAsRead " + num);
        chrome.runtime.sendMessage({ type: "popup-markasread", data: {num: num} }, function(response){
            render(response.threads);
        });
    }

    function updateAll() {
        chrome.runtime.sendMessage({ type: "popup-update-all" }, function(response){
            render(response.threads);
        });
    }

    function openAllUnread() {
//        chrome.runtime.sendMessage({ type: "popup-open-unread" }, function(){});
    }

    function updateThread(num) {
        chrome.runtime.sendMessage({ type: "popup-update", data: {num: num} }, function(response){
            render(response.threads)
        });
    }

    function urlhtml(board, num) {
        return "http://2ch.hk/" + board + "/res/" + num + ".html#bottom";
    }

    function renderLinks(threads) {
        var sorted = _.sortBy(threads, function(thread) { return -thread.unreads; });
        var links = $('#links-div');

        links.append("<div style='position: absolute; left: 490px; top: 0'><img src='images/reload.png' class='update-all-btn' " +
            "style='cursor:pointer;width: 24px; height: 24px' title='Обновить все' alt='Обновить все'></div>");

        for(key in sorted) {
            var thread = sorted[key];
            
            // console.log(key, thread);
            // var div_template = '<div> I am <span id="age"></span> years old!</div>';
            links.append(renderLinkRow(thread.board, thread.num, thread.unread, thread.title, thread.not_found_errors, thread.errors));

        }
    }

    function renderLinkRow(board, num, unreads, title, not_found_errors, errors) {
        var style = unreads > 0 ? "style='font-weight: bold'":"";


        var errors_status = vsprintf("%s%s", [not_found_errors > 0 ? " 404 ":"", errors > 0 ? " <span style='color:red'>err</span> ":""]);

        var markAsReadButton = unreads > 0 ? vsprintf(" <img title='Отметить как прочитанное' src='images/ok.png' style='cursor:pointer;width: 12px; height: 12px' class=read-btn thread-id=%d>", [num]):"";

        var updateButton = vsprintf(" <img title='Обновить' style='cursor: pointer;width: 12px; height: 12px' src='images/reload.png' class=update-btn thread-id=%d> ", [num]);
        
        return vsprintf("<div>(<span %s>%d</span>)%s%s%s<a class=thread-link href='%s' %s> /%s/%d - %s </a></div>",
            [style, unreads, markAsReadButton, updateButton, errors_status, urlhtml(board, num), style, board, num, title]);
    }

});