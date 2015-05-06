$(function(){

    $(document).on("click", ".thread-link", function() {
        chrome.tabs.create({url: $(this).attr('href')});
        return false;
    });
});