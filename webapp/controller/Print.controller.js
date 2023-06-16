/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/Fragment",
	"otc/ar/correspondence/create/v2/controller/Dialog.controller",
	"./utils/Mappings",
	"sap/m/MessageToast"
], function(Fragment, DialogController, Mappings, MessageToast) {
	"use strict";

	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mExternalActions = Mappings.ExternalActions;
	var mIds = Mappings.Ids;
	var mModelNames = Mappings.ModelNames;
	var mPrinters = Mappings.Printers;

	return DialogController.extend("otc.ar.correspondence.create.v2.controller.Print", {
		Id: mIds.PrintDialog,
		_sPrintType: "",
		_oPrintSmartField: null,

		initDialog: function(oOptions) {
			DialogController.prototype.initDialog.call(this, oOptions);
		},

		_validate: function() {
			return this.validateRequiredFields(this._oPrintSmartField);
		},

		onPrintChanged: function() {
			this._validate();
		},

		onPrint: function() {
			if (this._validate()) {
				var that = this;
				var aMassPrintData = this._aMassPrintData;
				var aData = [];

				this._oDialog.setBusy(true);

				if (jQuery.isArray(aMassPrintData) && aMassPrintData.length) {
					var sPrinter = this._oPrintSmartField.getValue();
					aMassPrintData.forEach(function(oItem) {
						var oContext = oItem.getBindingContext(mModelNames.CorrItems);
						var oData = this._oController.getInputData(oContext);
						oData.Print = {};
						oData.Print[this._sPrintType] = sPrinter;
						aData.push(oData);
					}, this);

					this.sendMassRequest(aData, aMassPrintData, "PRINTSUCCESS", mExternalActions.MassPrint).then(function(aResponseData) {
						that._setPrintStatus(aMassPrintData, aResponseData);

						that._oDialog.setBusy(false);
						that._oDialog.close();
					});
				} else {
					var oData = this._oController.getInputData();
					oData.Print = {};
					oData.Print[this._sPrintType] = this._oPrintSmartField.getValue();
					this.sendSingleRequest(oData, "PRINTSUCCESS").then(function() {
						that._oController._setCorrespondenceStatus(mCorrItemsProperties.Printed, true);
					});
				}
			}
		},

		_setPrintStatus: function(aCorrItems, aResponseData) {
			this._setCorrStatus(aCorrItems, aResponseData, mCorrItemsProperties.Printed);
		},

		onPrintDialogCloseButton: function() {
			this.closeDialog();
		},

		setData: function(oOptions) {
			this._sPrintType = oOptions.printType;
			this._oPrintSmartField = Fragment.byId(this.Id, "id" + this._sPrintType);
			this._aMassPrintData = oOptions.data;

			this.setTextControl(oOptions.text);
			this.setPrintFieldVisibility(oOptions.printType);
			this.setDefaults(oOptions.defaultData);
		},

		/**
		 * Sets description in text control in print fragment. Before the dialog is rendered for the first time,
		 * the text control does not exist yet, so it has to be set in afterOpen handler. It cannot be set every time
		 * in this handler, because there will be a few seconds before it is re-rendered with new text, so the old one
		 * would be shown.
		 *
		 * @param {string} sText description to be set
		 * @private
		 */
		setTextControl: function(sText) {
			var oPrintText = Fragment.byId(this.Id, mIds.MassPrintText);
			if (sText) {
				oPrintText.setText(sText);
				oPrintText.setVisible(true);
			} else {
				oPrintText.setVisible(false);
			}
		},

		setPrintFieldVisibility: function(sPrinterType) {
			var fnSetDisplayProperty = this._oController._setDisplayProperty.bind(this._oController);

			Object.keys(mPrinters).forEach(function(sKey) {
				fnSetDisplayProperty(mPrinters[sKey], (mPrinters[sKey] === sPrinterType));
			}, this);
		},

		setDefaults: function(oDefaults) {
			this.resetFields(this._oPrintSmartField);
			if (oDefaults) {
				this._oPrintSmartField.setValue(oDefaults[this._sPrintType] || "");
			}
		}
	});
});