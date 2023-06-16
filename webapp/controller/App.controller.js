/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"otc/ar/correspondence/create/v2/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function(BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("otc.ar.correspondence.create.v2.controller.App", {

		onInit: function() {
			var oViewModel = new JSONModel({
				busy: true,
				delay: 0
			});
			var fnSetAppNotBusy = function() {
				oViewModel.setProperty("/busy", false);
			};

			this.setModel(oViewModel, "appView");

			this.getOwnerComponent().getModel().metadataLoaded().then(fnSetAppNotBusy);

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}
	});

});