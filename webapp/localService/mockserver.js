/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/util/MockServer"
], function(MockServer) {
	"use strict";
	var oMockServer,
		_sAppModulePath = "fin/ar/correspondence/create/v2/",
		_sJsonFilesModulePath = _sAppModulePath + "localService/mockdata";

	return {
		COMPANY_DOES_NOT_EXIST: "FIN_CORR/040",

		/**
		 * Initializes the mock server.
		 * You can configure the delay with the URL parameter "serverDelay".
		 * The local mock data in this folder is returned instead of the real data for testing.
		 * @public
		 */
		init: function() {
			var oUriParameters = jQuery.sap.getUriParameters(),
				sJsonFilesUrl = jQuery.sap.getModulePath(_sJsonFilesModulePath),
				sManifestUrl = jQuery.sap.getModulePath(_sAppModulePath + "manifest", ".json"),
				sErrorParam = oUriParameters.get("errorType"),
				oManifest = jQuery.sap.syncGetJSON(sManifestUrl).data,
				oDataSource = oManifest["sap.app"].dataSources,
				oMainDataSource = oDataSource.mainService,
				sMetadataUrl = jQuery.sap.getModulePath(_sAppModulePath + oMainDataSource.settings.localUri.replace(".xml", ""), ".xml"),
				// ensure there is a trailing slash
				sMockServerUrl = /.*\/$/.test(oMainDataSource.uri) ? oMainDataSource.uri : oMainDataSource.uri + "/",
				aAnnotations = oMainDataSource.settings.annotations;

			oMockServer = new MockServer({
				rootUri: sMockServerUrl
			});

			// configure mock server with a delay of 1s
			MockServer.config({
				autoRespond: true,
				autoRespondAfter: (oUriParameters.get("serverDelay") || 10)
			});

			// load local mock data
			oMockServer.simulate(sMetadataUrl, {
				sMockdataBaseUrl: sJsonFilesUrl,
				bGenerateMissingMockData: true
			});

			var aRequests = oMockServer.getRequests(),
				fnResponse = function(iErrCode, sMessage, aRequest) {
					aRequest.response = function(oXhr) {
						oXhr.respond(iErrCode, {
							"Content-Type": "text/plain;charset=utf-8"
						}, sMessage);
					};
				};

			// handling the metadata error test
			if (oUriParameters.get("metadataError")) {
				aRequests.forEach(function(aEntry) {
					if (aEntry.path.toString().indexOf("$metadata") > -1) {
						fnResponse(500, "metadata Error", aEntry);
					}
				});
			}

			aRequests.push({
				method: "GET",
				path: new RegExp("renderEmailTemplate(.*)"),
				response: function(oXhr, sUrlParams) {
					var aTemplate = /MailTemplateId='(.*?)'/.exec(sUrlParams);
					var sTemplateFilter;

					if (aTemplate && aTemplate.length > 1) {
						sTemplateFilter = "?$filter=MailTemplateId eq '" + aTemplate[1] + "'";
					}

					var aCustomerNumber = /CustomerNumber='(.*?)'/.exec(sUrlParams);
					var aVendorNumber = /VendorNumber='(.*?)'/.exec(sUrlParams);
					var sAccountNumber = "";

					if (aCustomerNumber && aCustomerNumber.length > 1) {
						sAccountNumber = aCustomerNumber[1];
					} else if (aVendorNumber && aVendorNumber.length > 1) {
						sAccountNumber = aVendorNumber[1];
					}

					var oResponse = jQuery.sap.sjax({
						url: "/sap/opu/odata/sap/FI_CORRESPONDENCE_V2_SRV/EmailTemplateSet" + sTemplateFilter
					});

					// to test correct placeholder rendering in email templates
					if (oResponse.data.d.results.length === 1) {
						var oResult = oResponse.data.d.results[0];
						Object.keys(oResult).forEach(function(sProperty) {
							if (typeof oResult[sProperty] === "string") {
								oResult[sProperty] = oResult[sProperty].replace("{{AccountNumber}}", sAccountNumber);
							}
						});
					}

					oXhr.respondJSON(200, {}, JSON.stringify(oResponse.data));
					return true;
				}
			});

			aRequests.push({
				method: "GET",
				path: new RegExp("getDefaultValues(.*)"),
				response: function(oXhr, sUrlParams) {
					var oResponse = jQuery.sap.sjax({
						url: "/sap/opu/odata/sap/FI_CORRESPONDENCE_V2_SRV/DefaultValueSet"
					});

					// for Navigation module test - External API fallback email
					var sNavigationTestUrl = "?CompanyCode='0001'&" +
						"CorrespondenceTypeId='SAP08'&" +
						"CustomerNumber='ASD1'&" +
						"Date1=datetime'2011-11-11T00%3A00%3A00'&" +
						"Date2=datetime'9999-12-30T23%3A00%3A00'&" +
						"DocumentNumber=''&Event='SAP08'&" +
						"FiscalYear=''&" +
						"VariantId='SAP08'&" +
						"VendorNumber=''";

					// this call is important for the case when the customer field is not visible
					var sNavigationWithoutCustomerUrl = "?CompanyCode='0001'&CorrespondenceTypeId=''&CustomerNumber=''" +
						"&Date1=datetime'9999-12-30T23%3A00%3A00'&Date2=datetime'9999-12-30T23%3A00%3A00'" +
						"&DocumentNumber=''&Event=''&FiscalYear=''&VariantId=''&VendorNumber=''";

					if (sUrlParams === sNavigationTestUrl || sUrlParams === sNavigationWithoutCustomerUrl) {
						oResponse.data.d.results = oResponse.data.d.results.map(function(o) {
							if (o.Name === "BusinessPartner.EmailAddress") {
								o.Value = "";
							}
							return o;
						});
					}

					oXhr.respondJSON(200, {}, JSON.stringify(oResponse.data));

					return true;
				}
			});

			//mock for email/fax dialog send request
			aRequests.push({
				method: "GET",
				path: new RegExp("SendOutput(.*)"),
				response: function(oXhr, sUrlParams) {
					oXhr.respondJSON(200, {}, JSON.stringify({d: {results: []}}));
					return true;
				}
			});

			// Handling request errors -> call for corrTypeSet
			if (sErrorParam) {
				aRequests.forEach(function(aEntry) {
					if (aEntry.path.toString().indexOf("CorrTypeSet") > -1) {
						fnResponse(200, sErrorParam, aEntry);
					}
				});
			}

			aAnnotations.forEach(function(sAnnotationName) {
				var oAnnotation = oDataSource[sAnnotationName],
					sUri = oAnnotation.uri,
					sLocalUri = jQuery.sap.getModulePath(_sAppModulePath + oAnnotation.settings.localUri.replace(".xml", ""), ".xml");

				// annotations
				new MockServer({
					rootUri: sUri + "?sap-language=EN",
					requests: [{
						method: "GET",
						path: new RegExp(".*"),
						response: function(oXhr) {
							jQuery.sap.require("jquery.sap.xml");

							var oAnnotations = jQuery.sap.sjax({
								url: sLocalUri,
								dataType: "xml"
							}).data;

							oXhr.respondXML(200, {}, jQuery.sap.serializeXML(oAnnotations));
							return true;
						}
					}]
				}).start();
			});


			oMockServer.setRequests(aRequests);
			oMockServer.start();

			jQuery.sap.log.info("Running the app with mock data");
		},

		/**
		 * @public returns the mockserver of the app, should be used in integration tests
		 * @returns {sap.ui.core.util.MockServer} the mockserver instance
		 */
		getMockServer: function() {
			return oMockServer;
		}
	};

});