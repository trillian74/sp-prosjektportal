﻿var GT = GT || {};
GT.Project = GT.Project || {};
if (GT.jQuery === undefined) GT.jQuery = jQuery.noConflict(true);

GT.Project.ChangeProjectPhase = function () {
    var deferred = GT.jQuery.Deferred();

    var currentPhasePromise = GT.Project.GetPhaseTermFromCurrentItem();
    currentPhasePromise.done(function (term) {
        if (term != "" && term.get_label != undefined) {
            console.log('Changing phase to ' + term.get_label());
            GT.jQuery.when(
                GT.Project.ChangeQueryOfListViewOnPage(term.get_label(), "Dokumenter", "SitePages/Forside.aspx"),
                GT.Project.ChangeQueryOfListViewOnPage(term.get_label(), "Oppgaver", "SitePages/Forside.aspx"),
                GT.Project.ChangeQueryOfListViewOnPage(term.get_label(), "Usikkerhet", "SitePages/Forside.aspx"),
                GT.Project.SetMetaDataDefaultsForLib("Dokumenter", "GtProjectPhase", term)
            ).then(function() {
                deferred.resolve();
            });
        }
    });
    return deferred.promise();
};

GT.Project.ChangeQueryOfListViewOnPage = function (phaseName, listName, pageRelativeUrl) {
    var deferred = GT.jQuery.Deferred();
    var viewUrl = pageRelativeUrl;

    var clientContext = SP.ClientContext.get_current();
    var viewCollection = clientContext.get_web().get_lists().getByTitle(listName).get_views();

    clientContext.load(viewCollection);
    clientContext.executeQueryAsync(function () {
        var view = GT.Project.GetViewFromCollectionByUrl(viewCollection, viewUrl);
        if (view != null) {
            view.set_viewQuery("<Where><Eq><FieldRef Name='GtProjectPhase' /><Value Type='TaxonomyFieldType'>" + phaseName + "</Value></Eq></Where>");
            view.update();

            clientContext.executeQueryAsync(function () {
                deferred.resolve();
                console.log("Modified list view(s) of " + listName);
            }, function (sender, args) {
                deferred.reject();
                console.error('Request failed. ' + args.get_message());
            });
        } else {
            deferred.reject();
            console.log('Could not find any view with url ' + viewUrl + ' for list ' + listName);
        }
    }, function (sender, args) {
        deferred.reject();
        console.error('Request failed. ' + args.get_message());
    });
    return deferred.promise();
};

GT.Project.GetViewFromCollectionByUrl = function (viewCollection, url) {
    var serverRelativeUrl = _spPageContextInfo.webServerRelativeUrl + "/" + url;
    var viewCollectionEnumerator = viewCollection.getEnumerator();
    while (viewCollectionEnumerator.moveNext()) {
        var view = viewCollectionEnumerator.get_current();
        if (view.get_serverRelativeUrl().toString().toLowerCase() === serverRelativeUrl.toLowerCase()) {
            return view;
        }
    }
    return null;
};

GT.Project.SetMetaDataDefaultsForLib = function (lib, field, term) {
    // GtProjectPhase
    var deferred = GT.jQuery.Deferred();
    var termString = term.get_wssId() + ';#' + term.get_label() + '|' + term.get_termGuid();
    var siteCollRelativeUrl = _spPageContextInfo.webServerRelativeUrl + '/' + lib;
    var template = '<MetadataDefaults><a href="{siteCollRelativeUrl}"><DefaultValue FieldName="{field}">{term}</DefaultValue></a></MetadataDefaults>';
    var result = template.split("{siteCollRelativeUrl}").join(siteCollRelativeUrl);
    result = result.split("{field}").join(field);
    result = result.split("{term}").join(termString);

    var ctx = new SP.ClientContext.get_current();
    var web = ctx.get_web();
    // fragile, will not handle things living under "/lists"
    var list = web.get_lists().getByTitle(lib);
    var fileCreateInfo = new SP.FileCreationInformation();
    fileCreateInfo.set_url(siteCollRelativeUrl + "/Forms/client_LocationBasedDefaults.html");
    fileCreateInfo.set_content(new SP.Base64EncodedByteArray());
    fileCreateInfo.set_overwrite(true);
    var fileContent = result;

    for (var i = 0; i < fileContent.length; i++) {
        fileCreateInfo.get_content().append(fileContent.charCodeAt(i));
    }

    var existingFile = list.get_rootFolder().get_files().add(fileCreateInfo);
    ctx.executeQueryAsync(function (sender, args) {
        console.log("Saved metadata defaults of list " + lib);
        deferred.resolve();
    },
       function (sender, args) {
           console.log("fail: " + args.get_message());
           deferred.reject();
       });
    GT.Project.EnsureMetaDataDefaultsEventReceiver(lib);
    return deferred.promise();

};


GT.Project.EnsureMetaDataDefaultsEventReceiver = function (lib) {

    var ctx = new SP.ClientContext.get_current();
    var web = ctx.get_web();
    var eventReceivers = web.get_lists().getByTitle(lib).get_eventReceivers();
    ctx.load(eventReceivers);

    ctx.executeQueryAsync(function (sender, args) {
        var eventReceiversEnumerator = eventReceivers.getEnumerator();
        console.log(eventReceiversEnumerator);
        var eventReceiverExists = false;
        while (eventReceiversEnumerator.moveNext()) {
            var eventReceiver = eventReceiversEnumerator.get_current();
            var name = eventReceiver.get_receiverName();
            console.log(name);
            if (name === 'LocationBasedMetadataDefaultsReceiver ItemAdded') {
                console.log('Event Receiver exists, noop');
                eventReceiverExists = true;
            }
        }
        if (!eventReceiverExists) {
            var eventRecCreationInfo = new SP.EventReceiverDefinitionCreationInformation();
            eventRecCreationInfo.set_receiverName('LocationBasedMetadataDefaultsReceiver ItemAdded');
            eventRecCreationInfo.set_synchronization(1);
            eventRecCreationInfo.set_sequenceNumber(1000);
            eventRecCreationInfo.set_receiverAssembly('Microsoft.Office.DocumentManagement, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c');
            eventRecCreationInfo.set_receiverClass('Microsoft.Office.DocumentManagement.LocationBasedMetadataDefaultsReceiver');
            eventRecCreationInfo.set_eventType(SP.EventReceiverType.itemAdded);

            eventReceivers.add(eventRecCreationInfo);
            console.log('Added eventreceiver');

        }
    },
       function (sender, args) {
           console.log("fail: " + args.get_message());
       });
}


GT.Project.PopulateProjectPhasePart = function () {
    SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
        GT.jQuery.when(GT.Project.GetPhaseNameFromCurrentItem()).then(function (phaseName) {
            var phases = ['Konsept', 'Planlegge', 'Gjennomføre', 'Avslutte', 'Realisere'];
            for (var ix = 0; ix < phases.length; ix++) {
                GT.jQuery('.projectPhases').append(GT.Project.GetPhaseLogoMarkup(phases[ix], phases[ix] == phaseName, true));
            }
        });
    });
};

GT.Project.GetPhaseLogoMarkup = function (phaseName) {
    GT.Project.GetPhaseLogoMarkup(phaseName, false);
};

GT.Project.GetPhaseLogoMarkup = function (phaseName, selected, wrapInListItemMarkup) {
    var phaseDisplayName = "Ingen fase";
    var phaseLetter = 'X';
    var selectedClass = selected ? "selected" : '';
    if (phaseName != '' && phaseName != undefined) {
        phaseDisplayName = phaseName;
        phaseLetter = phaseName.substr(0, 1);
    }
    var markup = '<div class="gt-phaseIcon ' + selectedClass + '">' +
        '<span class="phaseLetter">' + phaseLetter + '</span>' +
        '<span class="projectPhase">' + phaseDisplayName + '</span>' +
        '</div>';
    if (wrapInListItemMarkup)
        return '<li class="' + selectedClass + '">' + markup + '</li>';
    return markup;
};

GT.Project.GetPhaseNameFromCurrentItem = function () {
    var defer = GT.jQuery.Deferred();
    GT.jQuery.when(GT.Project.GetPhaseTermFromCurrentItem()).done(function(term) {
        if (term != undefined && term != "" && term.get_label != undefined) {
            defer.resolve(term.get_label());
        } else {
            defer.resolve("");
        }
    });
    return defer.promise();
};

GT.Project.GetPhaseTermFromCurrentItem = function () {
    var deferred = GT.jQuery.Deferred();
    var pageFieldNameVar = 'GtProjectPhase';
    var context = SP.ClientContext.get_current();
    var web = context.get_web();

    //_spPageContextInfo is defined in every SharePoint page and has pageListId and pageItemId
    //properties populated in publishing pages
    var pageListId = _spPageContextInfo.pageListId;
    var pageItemId = _spPageContextInfo.pageItemId;

    //getting the list item for the current page
    var webLists = web.get_lists();
    var pageList = webLists.getById(pageListId);
    var pageItem = pageList.getItemById(pageItemId);

    //explicitly requesting to load the field Name for the page item
    context.load(pageItem, pageFieldNameVar);

    context.executeQueryAsync(Function.createDelegate(this, function () {
        var currentPhaseItem = pageItem.get_item(pageFieldNameVar);
        if (currentPhaseItem != '' && currentPhaseItem != undefined) {
            deferred.resolve(currentPhaseItem);
        } else {
            deferred.resolve('');
        }
    }), Function.createDelegate(this, function (sender, args) {
        deferred.resolve('');
        console.log('error when getting page field' + sender + " " + args);
    }));
    return deferred.promise();
};