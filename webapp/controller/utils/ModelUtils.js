/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/ValueState",
	"sap/m/ListMode",
	"./Mappings"
], function(ValueState, ListMode, Mappings) {
	"use strict";

	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mDefaultValues = Mappings.DefaultValues;
	var mDialogTypes = Mappings.DialogTypes;
	var mPropertyTypes = Mappings.ModelPropertyTypes;

	return {
		getBasicRenderTemplateObject: function() {
			return {
				CompanyCode: "",
				CustomerNumber: "",
				Date1: "datetime'9999-12-31T00:00'",
				Date2: "datetime'9999-12-31T00:00'",
				DocumentNumber: "",
				FiscalYear: "",
				MailTemplateId: "",
				Language: "",
				VendorNumber: ""
			};
		},

		getDefaultCorrItemObject: function(iId, sTitle) {
			return {
				Id: iId,
				BasicFields: {
					AccountNumber: "",
					AccountType: "",
					CompanyCode: "",
					CorrespondenceType: "",
					CustomerNumber: "",
					Date1: null,
					Date2: null,
					DocumentNumber: "",
					FiscalYear: "",
					VendorNumber: ""
				},
				Busy: {
					CompanyCode: false,
					CorrespondenceType: false,
					CustomerNumber: false,
					VendorNumber: false
				},
				CorrespondenceTypes: [],
				Dialog: {
					DefaultData: null,
					Invalidate: true
				},
				Editable: {
					AccountType: true,
					CompanyCode: true,
					CorrespondenceType: false,
					CustomerNumber: true,
					Date1: true,
					Date2: true,
					DocumentNumber: true,
					FiscalYear: true,
					VendorNumber: true
				},
				Email: this.getDefaultCorrItemEmailObject(),
				EmailType: "",
				Enabled: {
					EmailButton: true,
					PrintButton: true
				},
				IsActive: true,
				IsSelected: true,
				PdfPath: "",
				PrintType: "",
				SelectedCorrespondence: {},
				State: {
					AccountTypeIndex: 0,
					EmailSent: false,
					IsPdfViewerVisible: false,
					IsEmailFormVisible: false,
					Printed: false
				},
				Title: sTitle,
				ValueState: {
					CompanyCode: ValueState.None,
					CorrespondenceType: ValueState.None,
					CustomerNumber: ValueState.None,
					Date1: ValueState.None,
					Date2: ValueState.None,
					DocumentNumber: ValueState.None,
					FiscalYear: ValueState.None,
					VendorNumber: ValueState.None
				},
				ValueStateText: {
					CompanyCode: "",
					CorrespondenceType: "",
					CustomerNumber: "",
					Date1: "",
					Date2: "",
					DocumentNumber: "",
					FiscalYear: "",
					VendorNumber: ""
				},
				Visible: this.getDefaultCorrItemVisibleObject()
			};
		},

		getDefaultCorrItemVisibleObject: function() {
			return {
				AccountType: false,
				AdvancedParameters: false,
				CompanyCode: true,
				CorrespondenceType: true,
				CustomerNumber: false,
				Date1: false,
				Date2: false,
				DocumentNumber: false,
				FiscalYear: false,
				Printer: false,
				PrintQueue: false,
				PrintQueueSpool: false,
				VendorNumber: false
			};
		},

		getDefaultCorrItemEmailObject: function(bInvalidate) {
			bInvalidate = (bInvalidate === undefined) ? true : bInvalidate; // eslint-disable-line no-param-reassign

			return {
				EmailBusy: false,
				EmailContent: "",
				EmailContentVisible: false,
				EmailLanguage: "",
				Emails: [],
				EmailSubject: "",
				EmailTemplateVisible: false,
				EmailTo: "",
				EmailToState: ValueState.None,
				EmailToStateText: "",
				FallbackEmails: [],
				HtmlContent: "",
				InvalidateEmailSubject: bInvalidate,
				InvalidateEmailTemplate: bInvalidate,
				InvalidateEmailTemplatePreview: bInvalidate,
				InvalidateEmailTo: bInvalidate,
				InvalidateSenderAddress: bInvalidate,
				SenderAddress: "",
				SubjectChanged: false,
				Template: "",
				TemplateBusy: false,
				TemplateContentVisible: false,
				TemplateKey: "",
				Templates: [],
				TemplateState: ValueState.None,
				TemplateStateText: ""
			};
		},

		/**
		 * Returns default data for display model.
		 * @param {boolean} [bShareInJamVisible] Display Share in Jam. Default is false.
		 * @returns {*} default data for display model
		 */
		getDefaultDisplayModelData: function(bShareInJamVisible) {
			return {
				AddButton: true,
				CopyButton: true,
				EmailButton: true,
				FaxButton: false,
				MassDelete: true,
				PreviewButton: true,
				PrintButton: true,
				Printer: false,
				PrintQueue: false,
				PrintQueueSpool: false,
				ShareInJam: !!bShareInJamVisible,
				HistoryNavigationAvailable: true
			};
		},

		getDefaultDialogData: function(sType, aData, oContext) {
			var oDefaultData = {};
			var aDialogKeys = [];

			switch (sType) {
				case mDialogTypes.Email:
					aDialogKeys = [
						mDefaultValues["BusinessPartner.Partner"],
						mDefaultValues["BusinessPartner.EmailAddress"],
						mDefaultValues["Email.CompanyCode"],
						mDefaultValues["Email.ClerkSourceType"],
						mDefaultValues["Email.Language"],
						mDefaultValues["Email.Subject"],
						mDefaultValues["CompanyCode.EmailAddress"]];

					var sFallbackPath = this.getPropertyPath(mPropertyTypes.Email, mCorrItemsProperties.FallbackEmails);
					oDefaultData.FallbackEmails = oContext.getProperty(sFallbackPath);
					break;
				case mDialogTypes.Print:
					aDialogKeys = [
						mDefaultValues["Print.Printer"],
						mDefaultValues["Print.PrintQueue"],
						mDefaultValues["Print.PrintQueueSpool"]];
					break;
				default:
					return oDefaultData;
			}

			aData.forEach(function(oItem) {
				var sName = mDefaultValues[oItem.Name];
				if (jQuery.inArray(sName, aDialogKeys) !== -1) {
					if (oDefaultData[sName] && sName === mDefaultValues["BusinessPartner.EmailAddress"]) {
						oDefaultData[sName] = oDefaultData[sName] + Mappings.ValueSeparators.Email + oItem.Value;
					} else {
						oDefaultData[sName] = oItem.Value;
					}
				}
			});

			return oDefaultData;
		},

		getDefaultGlobalSettings: function() {
			return {
				AddAction: true,
				AdvancedParameters: true,
				ApplicationTitle: "",
				CopyAction: true,
				DeleteAction: true,
				EmailAction: true,
				EmailPreview: true,
				EnableSelecting: true,
				HistoryNavigation: true,
				MassEmailAction: true,
				MassPreviewAction: true,
				MassPrintAction: true,
				MultiSelect: true,
				OverviewFields: this.getDefaultOverviewFields(),
				PreviewAction: true,
				PrintAction: true,
				ReturnCallback: {
					Action: "",
					CustomData: "",
					ReturnAfterAction: [],
					SemanticObject: ""
				},
				SaveAsTile: true,
				Share: true,
				TriggerPreview: true,
				NotDownloadXML: true
			};
		},

		getDefaultOverviewFields: function() {
			return {
				AccountType: true,
				CompanyCode: true,
				CorrespondenceType: true,
				CustomerNumber: true,
				Date1: true,
				Date2: true,
				DocumentNumber: true,
				FiscalYear: true,
				VendorNumber: true
			};
		},

		getDefaultStateModelData: function() {
			return {
				CopyButton: true,
				DisplayHistoryButton: true,
				EmailButton: false,
				ListMode: ListMode.None,
				MassDelete: false,
				MassEmail: false,
				MassPrint: false,
				MultiSelect: false,
				PreviewButton: false,
				PreviewIcon: false,
				PrintButton: false,
				SelectAll: true,
				SelectAllVisible: false,
				DownloadXMLButton: false
			};
		},

		getDefaultValuesSenderObject: function() {
			return {
				CompanyCode: "",
				CorrespondenceTypeId: "",
				CustomerNumber: "",
				Date1: "9999-12-31T00:00",
				Date2: "9999-12-31T00:00",
				DocumentNumber: "",
				Event: "",
				FiscalYear: "",
				VariantId: "",
				VendorNumber: ""
			};
		},

		getBasicFieldPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.BasicFields, sProperty);
		},
		getBusyFieldPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Busy, sProperty);
		},
		getDialogPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Dialog, sProperty);
		},
		getVisiblePropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Visible, sProperty);
		},
		getEditablePropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Editable, sProperty);
		},
		getEnabledPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Enabled, sProperty);
		},
		getValueStatePropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.ValueState, sProperty);
		},
		getValueStateTextPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.ValueStateText, sProperty);
		},
		getEmailPropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.Email, sProperty);
		},
		getSelectedCorrespondencePath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.SelectedCorrespondence, sProperty);
		},
		getStatePropertyPath: function(sProperty) {
			return this.getPropertyPath(mPropertyTypes.State, sProperty);
		},
		getPropertyPath: function(sPropertyType, sProperty) {
			return sPropertyType + "/" + sProperty;
		}
	};
});
