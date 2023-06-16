/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function() {
	"use strict";

	return {
		Actions: Object.freeze({
			EnableSelecting: "EnableSelecting",
			PreselectAll: "PreselectAll",
			ReturnCallback: "ReturnCallback",
			TriggerPreview: "TriggerPreview"
		}),

		AccountTypes: Object.freeze({
			Customer: "D",
			None: "",
			Vendor: "K"
		}),

		AccountTypeIndices: Object.freeze({
			Customer: 0,
			Vendor: 1
		}),

		AdvancedParameterEvents: Object.freeze({
			ValidationError: "ValidationError",
			ValidationSuccess: "ValidationSuccess"
		}),

		AdvancedParameterTypes: Object.freeze({
			Boolean: "B",
			Date: "D",
			Number: "N",
			String: "S"
		}),

		ComplexTypes: Object.freeze({
			AdvancedParameters: "AuxiliaryTypeForAdvParams"
		}),

		ConfigurationChannels: Object.freeze({
			Email: "emailSupported",
			Fax: "faxSupported",
			Print: "printSupported"
		}),

		Controllers: Object.freeze({
			Email: "Email",
			Fax: "Fax",
			Print: "Print"
		}),

		CorrespondenceOutputProperties: Object.freeze({
			CompanyCode: "CompanyCode",
			CustomerNumber: "CustomerNumber",
			VendorNumber: "VendorNumber"
		}),

		CorrItemsProperties: Object.freeze({
			AccountNumber: "AccountNumber",
			AccountType: "AccountType",
			AccountTypeIndex: "AccountTypeIndex",
			AdvancedParameters: "AdvancedParameters",
			BusinessPartner: "BusinessPartner",
			CompanyCode: "CompanyCode",
			CompanyCodeName: "CompanyCodeName",
			CorrespondenceType: "CorrespondenceType",
			ClerkSourceType: "ClerkSourceType",
			CustomerName: "CustomerName",
			CustomerNumber: "CustomerNumber",
			Date1: "Date1",
			Date2: "Date2",
			DialogDefaultData: "DefaultData",
			DocumentNumber: "DocumentNumber",
			EmailBusy: "EmailBusy",
			EmailButton: "EmailButton",
			EmailContent: "EmailContent",
			EmailContentVisible: "EmailContentVisible",
			EmailLanguage: "EmailLanguage",
			Emails: "Emails",
			EmailSent: "EmailSent",
			EmailSubject: "EmailSubject",
			EmailTemplateVisible: "EmailTemplateVisible",
			EmailTo: "EmailTo",
			EmailToState: "EmailToState",
			EmailToStateText: "EmailToStateText",
			EmailType: "EmailType",
			Event: "Event",
			FallbackEmails: "FallbackEmails",
			FiscalYear: "FiscalYear",
			HtmlContent: "HtmlContent",
			Id: "Id",
			InvalidateDialog: "Invalidate",
			InvalidateEmailSubject: "InvalidateEmailSubject",
			InvalidateEmailTemplate: "InvalidateEmailTemplate",
			invalidateEmailTemplatePreview: "invalidateEmailTemplatePreview",
			InvalidateEmailTo: "InvalidateEmailTo",
			InvalidateSenderAddress: "InvalidateSenderAddress",
			IsActive: "IsActive",
			IsSelected: "IsSelected",
			Language: "Language",
			Name: "Name",
			IsPdfViewerVisible: "IsPdfViewerVisible",
			IsEmailFormVisible: "IsEmailFormVisible",
			CachedJsonParameters: "CachedJsonParameters",
			ParameterSet: "ParameterSet",
			PdfPath: "PdfPath",
			PrintButton: "PrintButton",
			Printed: "Printed",
			Printer: "Printer",
			PrintQueue: "PrintQueue",
			PrintQueueSpool: "PrintQueueSpool",
			SenderAddress: "SenderAddress",
			SubjectChanged: "SubjectChanged",
			Template: "Template",
			TemplateBusy: "TemplateBusy",
			TemplateContentVisible: "TemplateContentVisible",
			TemplateKey: "TemplateKey",
			Templates: "Templates",
			TemplateState: "TemplateState",
			TemplateStateText: "TemplateStateText",
			Title: "Title",
			Value: "Value",
			ValueState: "ValueState",
			ValueStateText: "ValueStateText",
			Variant: "VariantId",
			VendorName: "VendorName",
			VendorNumber: "VendorNumber"
		}),

		/**
		 * Returned values from getDefaultValues FunctionImport
		 */
		DefaultValues: Object.freeze({
			"BusinessPartner.Partner": "BusinessPartner",
			"BusinessPartner.EmailAddress": "EmailAddress",
			"CompanyCode.EmailAddress": "SenderAddress",
			"Email.CompanyCode": "CompanyCode",
			"Email.ClerkSourceType": "ClerkSourceType",
			"Email.Language": "EmailLanguage",
			"Email.Subject": "EmailSubject",
			"Print.Printer": "Printer",
			"Print.PrintQueue": "PrintQueue",
			"Print.PrintQueueSpool": "PrintQueueSpool"
		}),

		DialogTypes: Object.freeze({
			Email: "Email",
			Fax: "Fax",
			Print: "Print"
		}),

		DialogProperties: Object.freeze({
			BusinessPartner: "BusinessPartner",
			CompanyCode: "CompanyCode",
			CorrespondenceEmailSourceType: "CorrespondenceEmailSourceType"
		}),

		DisplaySettings: Object.freeze({
			AddAction: "AddButton",
			CopyAction: "CopyButton",
			DeleteAction: "MassDelete",
			EmailAction: "EmailAction",
			EmailPreview: "EmailPreview",
			EmailSubject: "EmailSubject",
			EmailTemplate: "EmailTemplate",
			MassEmailAction: "MassEmail",
			MassPrintAction: "MassPrint",
			PreviewAction: "PreviewButton",
			PrintAction: "PrintButton",
			HistoryNavigation: "HistoryNavigationAvailable"
		}),

		EmailDialogProperties: Object.freeze({
			EmailAddress: "EmailAddress",
			EmailEntityType: "FI_CORRESPONDENCE_V2_SRV.C_CpbupaemailvhType",
			CorrespondenceEmailSourceType: "CorrespondenceEmailSourceType",
			CorrespncEmailSourceTypeText: "CorrespncEmailSourceTypeText",
			CorrespncAddrShortWthStrText: "CorrespncAddrShortWthStrText",
			ValueHelpEmailsSet: "C_Cpbupaemailvh"
		}),

		EmailTypes: Object.freeze({
			EmailNewOm: "EmailNewOm",
			EmailOldOm: "EmailOldOm"
		}),

		EntityTypes: Object.freeze({
			CorrOutput: "CorrespondenceOutput",
			CorrSendOutput: "CorrSendOutput",
			Email: "Email",
			EmailTemplate: "EmailTemplate",
			EmailPreviewTemplate: "EmailPreviewTemplate"
		}),

		EntityTypesProperties: Object.freeze({
			Emailto: "To",
			EmailTemplate: "MailTemplate",
			PreviewHtml: "Preview_html",
			PreviewTxt: "Preview_txt"
		}),

		EntitySets: Object.freeze({
			CompanySet: "C_CorrespondenceCompanyCodeVH",
			ConfigurationSet: "ConfigurationSet",
			CorrOutputSet: "CorrespondenceOutputSet",
			CorrTypeSet: "CorrespondenceTypeSet",
			CustomerNumberSet: "C_CorrespondenceCustomerVH",
			EmailSet: "EmailSet",
			EmailTemplateSet: "EmailTemplateSet",
			ParameterSet: "ParameterSet",
			ParametersGroupSet: "ParametersGroupSet",
			PrintSet: "PrintSet",
			SupportedChannelSet: "SupportedChannelSet",
			VendorNumberSet: "C_CorrespondenceSupplierVH"
		}),

		ExternalActions: Object.freeze({
			MassEmail: "MassEmail",
			MassPrint: "MassPrint",
			DCHSemanticObject: "Correspondence",
			DCHAction: "displayHistory"
		}),

		FaxDialogProperties: Object.freeze({
			FaxNumber: "FaxNumber",
			FaxNumberExtension: "FaxNumberExtension",
			FaxType: "FI_CORRESPONDENCE_V2_SRV.Fax",
			FirstName: "FirstName",
			LastName: "LastName",
			ValueHelpFaxesSet: "ValueHelpFaxes"
		}),

		/**
		 * Bindings for SmartLabel properties that are bind to correspondence model.
		 * Relies on mBindings as keys.
		 */
		FieldLabels: Object.freeze({
			Date1: "Date1Text",
			Date2: "Date2Text",
			DocumentNumber: "DocumentText",
			FiscalYear: "FiscalYearText"
		}),

		FunctionImports: Object.freeze({
			RenderTemplate: "/renderEmailTemplate",
			GetDefaultValues: "/getDefaultValues"
		}),

		FunctionImportsDefaultParameters: Object.freeze({
			Process: "*"
		}),

		GlobalSettingsProperties: Object.freeze({
			AddAction: "AddAction",
			ApplicationTitle: "ApplicationTitle",
			CopyAction: "CopyAction",
			DeleteAction: "DeleteAction",
			EmailAction: "EmailButton",
			EmailPreview: "EmailPreview",
			EmailSubject: "EmailSubject",
			EmailTemplate: "EmailTemplate",
			HistoryNavigation: "HistoryNavigation",
			MassEmailAction: "MassEmailAction",
			MassPreviewAction: "MassPreviewAction",
			MassPrintAction: "MassPrintAction",
			OverviewFields: "OverviewFields",
			PreviewAction: "PreviewAction",
			PrintAction: "PrintAction",
			ReturnCallback: "ReturnCallback",
			SaveAsTile: "SaveAsTile",
			Share: "Share",
			TriggerPreview: "TriggerPreview"
		}),

		GlobalSettingsThatHidesShare: Object.freeze({
			AddAction: "AddAction",
			ApplicationTitle: "ApplicationTitle",
			CopyAction: "CopyAction",
			DeleteAction: "DeleteAction",
			EmailAction: "EmailButton",
			EmailPreview: "EmailPreview",
			HistoryNavigation: "HistoryNavigation",
			MassEmailAction: "MassEmailAction",
			MassPreviewAction: "MassPreviewAction",
			MassPrintAction: "MassPrintAction",
			PreviewAction: "PreviewAction",
			PrintAction: "PrintAction",
			SaveAsTile: "SaveAsTile",
			Share: "Share"
		}),

		/**
		 * Views IDs.
		 */
		Ids: Object.freeze({
			AccountType: "idAccountType",
			ActiveCorrItemForm: "idActiveCorrItemForm",
			AddButton: "idAddButton",
			AdvancedParamsToggle: "idAdvancedParamsToggle",
			AdvancedForm: "idAdvancedForm",
			CompanyCode: "idCompanyCode",
			CopyButton: "idCopyButton",
			CustomerNumber: "idCustomer",
			CustomerRadioBtn: "idBtnCustomer",
			CorrItemsList: "idCorrItemsList",
			DetailPage: "idDetailPage",
			Date1: "idDate1",
			Date1Label: "labelForIdDate1",
			Date2: "idDate2",
			Date2Label: "labelForIdDate2",
			Display: "idDisplay",
			DisplayHistoryButton: "idDisplayHistoryButton",
			DocumentNumber: "idDocument",
			Email: "idEmail",
			EmailContent: "idEmailContent",
			EmailDialog: "idEmailDialog",
			EmailEmailto: "idEmailto",
			EmailSender: "idEmailSender",
			EmailSubject: "idEmailSubject",
			EmailTemplate: "idEmailTemplate",
			Event: "idCorrespondence",
			FaxCountryCode: "idFaxCountryCode",
			FaxDialog: "idFaxDialog",
			FaxNumber: "idFaxNumber",
			FiscalYear: "idFiscalYear",
			IconTabBar: "idIconTabBar",
			IconTabBarFilterCorrData: "idIconTabBarFilterCorrespondenceData",
			IconTabBarFilterEmail: "idIconTabBarFilterEmail",
			IconTabBarFilterPdf: "idIconTabBarFilterPdf",
			MassDelete: "idMassDeleteButton",
			MassEmail: "idMassEmailButton",
			MassPreview: "idMassPreviewButton",
			MassPrint: "idMassPrintButton",
			MassPrintText: "idMassPrintText",
			MasterPage: "idMasterPage",
			MessagePopoverButton: "idMessagePopoverButton",
			MultiSelect: "idMultiSelect",
			OutputControlContainer: "idOutputControlContainer",
			Page: "idPage",
			PagingButton: "idPagingButton",
			Pdf: "idPdf",
			Preview: "idPreview",
			Print: "idPrint",
			PrintDialog: "idPrintDialog",
			SaveAsTile: "idSaveTile",
			SelectAllLabelTitle: "idSelectAllLabelTitle",
			SelectAllButton: "idSelectAllButton",
			VendorNumber: "idVendor",
			VendorRadioBtn: "idBtnVendor",
			DownloadXML: "idDownloadXML"
		}),

		/**
		 * Bindings names for every inputable control
		 */
		InputFields: Object.freeze({
			CompanyCode: "CompanyCode",
			CorrespondenceType: "CorrespondenceTypeId",
			Event: "Event",
			CustomerNumber: "CustomerNumber",
			DocumentNumber: "DocumentNumber",
			Date1: "Date1",
			Date2: "Date2",
			FiscalYear: "FiscalYear",
			Variant: "VariantId",
			VendorNumber: "VendorNumber"
		}),

		/**
		 * Bindings for mass buttons
		 */
		MasterPageButtons: Object.freeze({
			Delete: "MassDelete",
			DisplayHistory: "DisplayHistoryButton",
			Email: "MassEmail",
			Print: "MassPrint",
			Copy: "CopyButton",
			Preview: "MassPreview"
		}),

		MessagePopoverKeys: Object.freeze({
			Emailto: "To",
			EmailTemplate: "MailTemplateId"
		}),

		MessagePopoverGroups: Object.freeze({
			Email: "Email"
		}),

		ModelNames: {
			CorrItems: "corrItems",
			Display: "display",
			GlobalSettings: "globalSettings",
			State: "state",
			Popover: "popover"
		},

		ModelPropertyTypes: Object.freeze({
			BasicFields: "BasicFields",
			Busy: "Busy",
			CorrespondenceTypes: "CorrespondenceTypes",
			Dialog: "Dialog",
			Editable: "Editable",
			Email: "Email",
			EmailType: "EmailType",
			Enabled: "Enabled",
			Id: "Id",
			OverviewFields: "OverviewFields",
			PrintType: "PrintType",
			SelectedCorrespondence: "SelectedCorrespondence",
			State: "State",
			ValueState: "ValueState",
			ValueStateText: "ValueStateText",
			Visible: "Visible"
		}),

		/**
		 * Bindings without possibility of value input
		 */
		NonValueBindings: Object.freeze({
			AccountType: "AccountType",
			// Controller of whether 'Customer' or 'Vendor' is selected
			AccountTypeIndex: "AccountTypeIndex",
			// Button that adds new correspondence item
			AddButton: "AddButton",
			// Buttons for default (NOT resend billing correspondence)
			DefaultButtons: "DefaultButtons",
			EmailButton: "EmailButton",
			ListMode: "ListMode",
			MultiSelect: "MultiSelect",
			PrintButton: "PrintButton",
			// Buttons for resend billing (if RB correspondence type is selected)
			RbButtons: "RbButtons",
			// Preview button for resend billing in on premise systems (show only in some cases, where there is possibility for viewing PDF through external app
			RbPreview: "RbPreview",
			// default preview button
			PreviewButton: "PreviewButton",
			PagingButton: "PagingButton",
			DownloadXMLButton: "DownloadXMLButton",
		}),

		/**
		 * Types of printers based on EventOM and Cloud
		 */
		Printers: Object.freeze({
			Printer: "Printer",
			PrintQueue: "PrintQueue",
			PrintQueSp: "PrintQueueSpool"
		}),

		RangeOptions: Object.freeze({
			Equal: "EQ",
			Greater: "GT",
			GreaterEqual: "GE",
			Less: "LT",
			LessEqual: "LE",
			Between: "BT",
			Contains: "CP"
		}),

		RangeSigns: Object.freeze({
			Exclude: "E",
			Include: "I"
		}),

		RegularPatterns: Object.freeze({
			DocumentNumber: /^\w+$/,
			Email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
			FiscalYear: /^[1-9][0-9]{3}$/,
			Number: /^\d+$/,
			Separators: /[,; ]+/i
		}),

		ValueSeparators: Object.freeze({
			Email: ";"
		}),

		RequestModes: Object.freeze({
			Email: "I",
			Fax: "2",
			Print: "1"
		}),

		/**
		 * Additional parameters that can be used by external applications (by URL) to set environment in send correspondence
		 */
		Services: Object.freeze({
			Correspondence: "FI_CORRESPONDENCE_V2_SRV",
			ShellUIService: "ShellUIService"
		}),

		StateProperties: Object.freeze({
			ListMode: "ListMode",
			MultiSelect: "MultiSelect",
			SelectAll: "SelectAll",
			SelectAllVisible: "SelectAllVisible"
		}),

		SupportedChannels: Object.freeze({
			EmailNewOm: "EmailNewOm",
			EmailOldOm: "EmailOldOm",
			Printer: "Printer",
			PrintQueue: "PrintQueue",
			PrintQueueSpool: "PrintQueSp"
		}),

		UrlParameters: Object.freeze({
			AccountNumber: "AccountNumber",
			AccountType: "AccountType",
			AccountTypeCustomer: "D",
			AccountTypeVendor: "K",
			BillingDocument: "BillingDocument",
			Correspondence: "Correspondence",
			Customer: "Customer",
			IsBillDoc: "IsBillDoc",
			ProcessContext: "ProcessContext",
			Supplier: "Supplier"
		}),

		ValueListTypes: Object.freeze({
			DisplayOnly: "com.sap.vocabularies.Common.v1.ValueListParameterDisplayOnly",
			FilterOnly: "com.sap.vocabularies.Common.v1.ValueListParameterFilterOnly",
			In: "com.sap.vocabularies.Common.v1.ValueListParameterIn",
			InOut: "com.sap.vocabularies.Common.v1.ValueListParameterInOut",
			Out: "com.sap.vocabularies.Common.v1.ValueListParameterOut"
		})
	};
}, true);