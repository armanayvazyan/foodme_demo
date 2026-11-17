import {
    Edit,
    SimpleForm,
    TextInput,
    NumberInput,
    SelectInput,
} from 'react-admin';

const statusChoices = [
    { id: 'ACTIVE', name: 'ACTIVE' },
    { id: 'INACTIVE', name: 'INACTIVE' },
];

const ChefEdit = () => (
    <Edit>
        <SimpleForm>
            <TextInput source="username" fullWidth />
            <TextInput source="phoneNumber" label="Phone" fullWidth />
            <SelectInput source="status" choices={statusChoices} fullWidth />
            <NumberInput source="deliveryPrice" label="Delivery price" />
            <NumberInput source="freeDeliveryFrom" label="Free delivery from" />
        </SimpleForm>
    </Edit>
);

export default ChefEdit;
