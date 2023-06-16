/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function(UI5Object, MessageBox) {
	"use strict";

	return UI5Object.extend("otc.ar.correspondence.create.v2.controller.ErrorHandler", {

		/**
		 * Error code for 'getCorrespondences', when company doesn't exist
		 */
		COMPANY_DOES_NOT_EXIST: "FIN_CORR/040",

		/**
		 * Error code for 'preview', when customer doesn't exist
		 */
		CUSTOMER_DOES_NOT_EXIST: "F5/102",

		/**
		 * Error code for 'preview', when customer doesn't exist
		 */
		VENDOR_DOES_NOT_EXIST: "FIN_CORR/041",

		/**
		 * Generic exception if something goes wrong when preview pressed
		 */
		GENERIC_EXCEPTION: "/IWBEP/CX_MGW_BUSI_EXCEPTION",

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias otc.ar.correspondence.create.v2.controller.ErrorHandler
		 */
		constructor: function(oComponent) {
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._oModel = oComponent.getModel();
			this._bMessageOpen = false;
			this._sErrorText = this._oResourceBundle.getText("errorText");

			this._oModel.attachMetadataFailed(this.metadataFailedHandler, this);

			this._oModel.attachRequestFailed(this.requestFailedHandler, this);
		},

		metadataFailedHandler: function(oEvent) {
			var oParams = oEvent.getParameters();
			this._showMetadataError(oParams.response);
		},

		requestFailedHandler: function(oEvent) {
			var oParams = oEvent.getParameters();

			if (oParams.response.statusCode !== "404") {
				this.showDetailError(oParams.response);
			}
		},

		/**
		 * Test whether returned error from servise is Company not found error (which requires special handling)
		 *
		 * @param {object} oEvent Data returned from request
		 * @returns {boolean} true for company not found error
		 */
		isCompanyNotFoundError: function(oEvent) {
			try {
				var oParsedData = jQuery.parseJSON(oEvent.responseText);
			} catch (e) {
				return false;
			}

			return oParsedData && oParsedData.error && oParsedData.error.code === this.COMPANY_DOES_NOT_EXIST;
		},

		/**
		 * Test whether error code is invalid customer error
		 * @param {string} sCode error code
		 * @public
		 * @returns {boolean} true for customer error
		 */
		isCustomerError: function(sCode) {
			return sCode === this.CUSTOMER_DOES_NOT_EXIST;
		},

		/**
		 * Test whether error code is invalid vendor error
		 * @param {string} sCode error code
		 * @public
		 * @returns {boolean} true for vendor error
		 */
		isVendorError: function(sCode) {
			return sCode === this.VENDOR_DOES_NOT_EXIST;
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when the metadata call has failed.
		 * The user can try to refresh the metadata.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showMetadataError: function(sDetails) {
			MessageBox.error(
				this._sErrorText, {
					id: "metadataErrorMessageBox",
					details: sDetails,
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.RETRY, MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === MessageBox.Action.RETRY) {
							this._oModel.refreshMetadata();
						}
					}.bind(this)
				}
			);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * @param {string} sErrorText error text to be displayed
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		showError: function(sErrorText, sDetails) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(
				sErrorText ? sErrorText : this._sErrorText, {
					id: "serviceErrorMessageBox",
					details: sDetails,
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.CLOSE],
					onClose: function() {
						this._bMessageOpen = false;
					}.bind(this)
				}
			);
		},

		/**
		 * Show detail text as error. If no detail error is present (or cannot be parsed, show whole response object)
		 *
		 * @param {object} oResponse Data sent from server
		 * @public
		 */
		showDetailError: function(oResponse) {
			var canShowDetail = true;
			var body;

			try {
				body = JSON.parse(oResponse.responseText);
			} catch (err) {
				canShowDetail = false;
			}

			if (canShowDetail && body && body.error && body.error.message) {
				this.showError(body.error.message.value);
				return;
			}

			this.showError("", oResponse);
		},

		/**
		 * Try to parse incoming PDF iFrame and if it contains error message, parse it, display message box with text and hide PDF iFrame.
		 * @param {object} oDocument document from iFrame
		 * @returns {object} Data with possible error.
		 */
		handlePdfError: function(oDocument) {
			var oError = this._parsePdfErrorMessage(oDocument);

			if (oError.isError) {
				if (oError.hasInnerError) {
					this.showError(oError.errorMessage, oError.errorDetailMessage);
				} else {
					this.showError("", oError.errorMessage);
				}
			}

			return oError;
		},

		/**
		 * In case we already know the IFRAME contains error tag with some error messages, try to parse it.
		 * @param {object} oDocument IFRAME document object
		 * @returns {object} error information
		 * @private
		 */
		_parseErrorTag: function(oDocument) {
			// Find generic error message
			var aErrorNodes = oDocument.firstChild.childNodes,
				sGenericErrorMessage = aErrorNodes.length > 1 && aErrorNodes[1].textContent || "",
				bIsCustomer = false,
				bIsVendor = false,
				sCode = aErrorNodes.length > 0 && aErrorNodes[0].textContent || "",
				that = this;

			// Find detailed error message
			var aErrors = jQuery.makeArray(oDocument.getElementsByTagName("errordetail"));
			var aErrorMessages = aErrors.filter(function(oElement) {
				// Filter out generic errors
				var bIsGenericException = sCode === that.GENERIC_EXCEPTION;

				// set error states
				bIsVendor = sCode === that.VENDOR_DOES_NOT_EXIST;
				bIsCustomer = sCode === that.CUSTOMER_DOES_NOT_EXIST;

				return !bIsGenericException;
			}).map(function(oElement) {
				// Get the text of the error
				var aMessages = oElement.getElementsByTagName("message");
				return aMessages && aMessages[0] && aMessages[0].textContent || "";
			});

			if (aErrorMessages.length === 0) {
				return {
					isError: false
				};
			}

			var sErrorMessage = aErrorMessages.shift().trim().replace(/&/g, "");
			var sDetailErrorMessage = aErrorMessages.join("<br>").trim().replace(/&/g, "");

			// Return detailed message or fallback to generic message
			return {
				isError: true,
				hasInnerError: aErrorNodes.length > 2,
				errorMessage: sErrorMessage,
				errorDetailMessage: sDetailErrorMessage || sGenericErrorMessage || "",
				isCustomer: bIsCustomer,
				isVendor: bIsVendor
			};
		},

		/**
		 * Try to find out whether IFRAME document contains correct PDF. If not, try to find the error.
		 * The error can be held in several locations.
		 *            A. In this case server accepted the request but for some reason it refused it. There will be error tag as first child of document.
		 *               Error should be known (such as 'Wrong customer') or at least stack trace should be displayable in detail of message box.
		 *        B. Server didn't get the request or some unexpected error happened. In such case error text is in body element as plain text. Display it
		 *               as detail in message box.
		 *
		 * @param {object} oDocument Document object with IFRAME content
		 * @returns {object} Information whether IFRAME contains error and what error (if any)
		 * @private
		 */
		_parsePdfErrorMessage: function(oDocument) {
			var ERROR_TAG_NAME = "error";
			var BODY_TAG_NAME = "body";
			var EMBED_TAG_NAME = "EMBED";

			if (oDocument) {
				if (oDocument.firstChild && oDocument.firstChild.nodeName === ERROR_TAG_NAME) {
					return this._parseErrorTag(oDocument);
				}

				var oBody = oDocument.getElementsByTagName(BODY_TAG_NAME)[0];
				if (oBody) {
					if (oBody.textContent) {
						// ensure embed tag (PDF) is missing
						var isEmbed = oBody.childNodes && oBody.childNodes[0] && oBody.childNodes[0].nodeName === EMBED_TAG_NAME;
						if (!isEmbed) {
							return {
								isError: true,
								hasInternalError: false,
								errorMessage: oBody.textContent
							};
						}
					}
				}
			}

			return {
				isError: false
			};
		}
	});
});