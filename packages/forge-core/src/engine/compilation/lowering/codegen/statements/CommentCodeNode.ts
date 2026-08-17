import CodeNode from './CodeNode'

export default class CommentCodeNode extends CodeNode {
  constructor(
    private readonly commentText: string,
    private readonly bannerComment: boolean,
  ) {
    super()
  }

  get text(): string {
    return this.commentText
  }

  get banner(): boolean {
    return this.bannerComment
  }
}
