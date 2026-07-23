import * as React from 'react';
import { Message, Icon } from 'semantic-ui-react';

interface Props {
  item: string;
  id: string;
}

interface State {
}

export class NotFound extends React.PureComponent<Props, State> {
  componentDidMount() {
    const { item, id } = this.props;
    console.info(`${item} with ID ${id} could not be found`);
  }

  render() {
    const { item, id } = this.props;
    return (
      <Message error icon>
        <Icon name="question" />
        <Message.Content>
          <Message.Header as="h1">Không tìm thấy</Message.Header>
          Không thể tìm thấy {item} bạn đang tìm (ID: {id}).
          Nó có thể đã bị xóa, hoặc đường link bạn vừa truy cập chưa chính xác.
        </Message.Content>
      </Message>
    );
  }
}
