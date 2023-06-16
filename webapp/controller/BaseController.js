/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/core/UIComponent"
], function(Controller, History, UIComponent) {
	"use strict";

	return Controller.extend("fin.ar.correspondence.create.v2.controller.BaseController", {
		metadata: {
			"abstract": true
		},
		/**
		 * Convenience method for accessing the router.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function() {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function(sName) {
			return this.getOwnerComponent().getModel(sName);
		},

		/**
		 * Returns error handler for this app.
		 * @public
		 * @returns {object} ErrorHandler instance
		 */
		getErrorHandler: function() {
			return this.getOwnerComponent().getErrorHandler();
		},

		/**
		 * Convenience method for setting the view model.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function(oModel, sName) {
			return this.getOwnerComponent().setModel(oModel, sName);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function() {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Getter for the translated text.
		 * @param {string} sText key to i18n model
		 * @param {array} [aArguments] optional arguments for i18n text
		 *
		 * @public
		 * @returns {string} translated text
		 */
		translateText: function(sText, aArguments) {
			return this.getResourceBundle().getText(sText, aArguments);
		},

		/**
		 * Getter for the translated text from sap.ui.core resource bundle.
		 * @param {string} sText key to sap.ui.core model
		 *
		 * @public
		 * @returns {string} translated text
		 */
		translateCoreText: function(sText) {
			return sap.ui.getCore().getLibraryResourceBundle("sap.ui.core").getText(sText);
		},

		/**
		 * Disable controls and display busy indicator
		 * @public
		 */
		setBusy: function() {
			this.getModel("appView").setProperty("/busy", true);
		},

		/**
		 * Enables controls and hide busy indicator
		 * @public
		 */
		setNotBusy: function() {
			this.getModel("appView").setProperty("/busy", false);
		},

		/**
		 * Event handler when the share on Jam been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			this._storeCurrentAppState();
			var oShareDialog = sap.ui.getCore().createComponent({
				name: "sap.collaboration.components.fiori.sharing.dialog",
				settings: {
					object: {
						id: document.URL,
						share: this.translateText("SHARE_TITLE")
					}
				}
			});
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), oShareDialog);
			oShareDialog.open();
		},

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onShareEmailPress: function() {
			this._storeCurrentAppState();

			sap.m.URLHelper.triggerEmail(
				null,
				this.translateText("SHARE_EMAIL_SUBJECT"),
				document.URL
			);
		},

		/**
		 * Event handler when the back button has been clicked
		 * @public
		 */
		onNavBack: function() {
			/*
			var oHistory, sPreviousHash;
			oHistory = History.getInstance();
			sPreviousHash = oHistory.getPreviousHash();
			if (sPreviousHash !== undefined) {
				window.history.back();
			} else {
				var oRouter = UIComponent.getRouterFor(this);
				oRouter.navTo("main", {}, true);
			}
			 */
			window.history.back();
		}
	});

});